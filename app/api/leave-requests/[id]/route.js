import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const { status, review_note } = await request.json()
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `UPDATE main.leave_requests
       SET status = $1, reviewed_by = $2, review_note = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *, (SELECT user_id FROM main.leave_requests WHERE id = $4) AS target_user_id`,
      [status, session.user.id, review_note?.trim() || null, id]
    )
    if (!result.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const leave = result.rows[0]

    // Notify the requesting agent
    await pool.query(
      `INSERT INTO main.notifications (user_id, type, title, body, link)
       VALUES ($1, 'leave_request', $2, $3, '/briefing')`,
      [
        leave.user_id,
        `Leave request ${status}`,
        review_note?.trim() || `Your leave request (${leave.start_date} – ${leave.end_date}) was ${status}`,
      ]
    ).catch(() => {})

    return NextResponse.json(leave)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
