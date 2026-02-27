import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET current user's notifications (last 50, unread first)
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await pool.query(
      `SELECT id, type, title, body, link, is_read, created_at
       FROM test.notifications
       WHERE user_id = $1
       ORDER BY is_read ASC, created_at DESC
       LIMIT 50`,
      [session.user.id]
    )
    const unreadCount = result.rows.filter(n => !n.is_read).length
    return NextResponse.json({ notifications: result.rows, unread_count: unreadCount })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — mark all as read OR create a system notification (admin only)
export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // mark_all_read action
  if (body.action === 'mark_all_read') {
    await pool.query(
      `UPDATE test.notifications SET is_read = true WHERE user_id = $1`,
      [session.user.id]
    )
    return NextResponse.json({ ok: true })
  }

  // Create notification (admin only — for broadcast)
  if (session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, type, title, body: notifBody, link } = body
  if (!user_id || !type || !title)
    return NextResponse.json({ error: 'user_id, type, title required' }, { status: 400 })

  try {
    const result = await pool.query(
      `INSERT INTO test.notifications (user_id, type, title, body, link)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, type, title, notifBody, link]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
