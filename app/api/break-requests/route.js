import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true' && session.user.role === 'admin'

  try {
    const result = await pool.query(
      `SELECT br.*, u.full_name as agent_name, u.email as agent_email,
              r.full_name as reviewer_name,
              sr.shift_date, sr.start_time, sr.end_time
       FROM main.break_requests br
       JOIN main.users u ON u.id = br.user_id
       LEFT JOIN main.users r ON r.id = br.reviewed_by
       LEFT JOIN main.shift_rotas sr ON sr.id = br.shift_id
       ${all ? '' : 'WHERE br.user_id = $1'}
       ORDER BY br.requested_at DESC`,
      all ? [] : [session.user.id]
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shift_id, duration_mins, note } = await request.json()
  if (!duration_mins) return NextResponse.json({ error: 'duration_mins required' }, { status: 400 })

  try {
    const result = await pool.query(
      `INSERT INTO main.break_requests (user_id, shift_id, duration_mins, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [session.user.id, shift_id || null, duration_mins, note || null]
    )
    const req = result.rows[0]

    // Notify admins
    const admins = await pool.query(`SELECT id FROM main.users WHERE role = 'admin' AND is_active = true`)
    for (const admin of admins.rows) {
      await pool.query(
        `INSERT INTO main.notifications (user_id, type, title, body, link)
         VALUES ($1, 'system', $2, $3, '/agent-status')`,
        [
          admin.id,
          `Break request from ${session.user.name || session.user.email}`,
          `Requested a ${duration_mins}-minute break${note ? `: ${note}` : ''}.`,
        ]
      ).catch(() => {})
    }

    return NextResponse.json(req, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
