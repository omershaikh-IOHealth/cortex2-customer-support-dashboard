import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// PUT — mark single notification as read
export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  try {
    await pool.query(
      `UPDATE test.notifications SET is_read = true
       WHERE id = $1 AND user_id = $2`,
      [id, session.user.id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
