import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// PUT — admin approves/rejects a break request
export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status } = await request.json()
  if (!['approved', 'rejected'].includes(status))
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })

  try {
    const result = await pool.query(
      `UPDATE main.break_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3
       RETURNING *, (SELECT user_id FROM main.break_requests WHERE id = $3) as agent_user_id`,
      [status, session.user.id, id]
    )
    const req = result.rows[0]

    // Notify the agent
    if (req?.user_id) {
      await pool.query(
        `INSERT INTO main.notifications (user_id, type, title, body)
         VALUES ($1, 'system', $2, $3)`,
        [
          req.user_id,
          `Break request ${status}`,
          `Your break request has been ${status} by ${session.user.name || 'admin'}.`,
        ]
      ).catch(() => {})
    }

    return NextResponse.json(req)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
