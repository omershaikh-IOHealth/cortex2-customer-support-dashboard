import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true' && session.user.role === 'admin'

  try {
    const result = await pool.query(`
      SELECT ss.*,
        req.full_name AS requester_name, req.email AS requester_email,
        tgt.full_name AS target_agent_name, tgt.email AS target_agent_email,
        sup.full_name AS supervisor_name,
        rs.shift_date AS requester_shift_date, rs.start_time AS requester_start, rs.end_time AS requester_end,
        ts.shift_date AS target_shift_date, ts.start_time AS target_start, ts.end_time AS target_end
      FROM main.shift_swaps ss
      JOIN main.users req ON req.id = ss.requester_id
      JOIN main.users tgt ON tgt.id = ss.target_agent_id
      LEFT JOIN main.users sup ON sup.id = ss.supervisor_id
      LEFT JOIN main.shift_rotas rs ON rs.id = ss.requester_shift_id
      LEFT JOIN main.shift_rotas ts ON ts.id = ss.target_shift_id
      WHERE ${all ? 'TRUE' : 'ss.requester_id = $1 OR ss.target_agent_id = $1'}
      ORDER BY ss.created_at DESC
    `, all ? [] : [session.user.id])
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requester_shift_id, target_agent_id, target_shift_id } = await request.json()
  if (!requester_shift_id || !target_agent_id) {
    return NextResponse.json({ error: 'requester_shift_id and target_agent_id are required' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO main.shift_swaps
         (requester_id, requester_shift_id, target_agent_id, target_shift_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [session.user.id, requester_shift_id, target_agent_id, target_shift_id || null]
    )

    // Notify target agent
    await pool.query(
      `INSERT INTO main.notifications (user_id, type, title, body, link)
       VALUES ($1, 'shift_swap', 'Shift swap request', $2, '/briefing')`,
      [target_agent_id, `${session.user.name || session.user.email} wants to swap shifts with you`]
    ).catch(() => {})

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
