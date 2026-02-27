import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET agent status
export async function GET(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  try {
    const result = await pool.query(
      `SELECT s.status, s.status_note, s.set_at, u.full_name, u.email
       FROM test.agent_status s
       JOIN test.users u ON u.id = s.user_id
       WHERE s.user_id = $1`,
      [id]
    )
    return NextResponse.json(result.rows[0] || { status: 'offline', status_note: null, set_at: null })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT — agent updates own status; admin can update any agent
export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  // Agents can only update their own status
  if (session.user.role !== 'admin' && String(session.user.id) !== String(id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, status_note } = await request.json()
  const allowed = ['available', 'break', 'not_ready', 'meeting', 'offline', 'busy']
  if (!allowed.includes(status))
    return NextResponse.json({ error: `status must be one of: ${allowed.join(', ')}` }, { status: 400 })

  try {
    await pool.query(
      `INSERT INTO test.agent_status (user_id, status, status_note, set_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         status      = EXCLUDED.status,
         status_note = EXCLUDED.status_note,
         set_at      = NOW()`,
      [id, status, status_note || null]
    )

    // If going on break, fire a notification to admin users after 30 min (handled client-side for now)
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
