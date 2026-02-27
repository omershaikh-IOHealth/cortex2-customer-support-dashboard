import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// POST — assign ticket to an agent
// Body: { assigned_to_id, assigned_to_email }
export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  const { assigned_to_id, assigned_to_email } = await request.json()

  if (!assigned_to_id && !assigned_to_email)
    return NextResponse.json({ error: 'assigned_to_id or assigned_to_email required' }, { status: 400 })

  try {
    // Resolve email from id if not provided
    let email = assigned_to_email
    let userId = assigned_to_id

    if (userId && !email) {
      const u = await pool.query('SELECT email FROM test.users WHERE id = $1', [userId])
      email = u.rows[0]?.email
    } else if (email && !userId) {
      const u = await pool.query('SELECT id FROM test.users WHERE email = $1', [email])
      userId = u.rows[0]?.id
    }

    await pool.query(
      `UPDATE test.tickets
       SET assigned_to_id = $1, assigned_to_email = $2
       WHERE id = $3`,
      [userId, email, id]
    )

    // Log assignment in threads
    await pool.query(
      `INSERT INTO test.threads (ticket_id, action_type, thread_source, notes, created_by_email)
       VALUES ($1, 'assignment', 'internal', $2, $3)`,
      [id, `Assigned to ${email}`, session.user.email]
    )

    // Notify the assigned agent
    if (userId) {
      await pool.query(
        `INSERT INTO test.notifications (user_id, type, title, body, link)
         VALUES ($1, 'assignment', 'Ticket Assigned', $2, $3)`,
        [userId, `Ticket #${id} has been assigned to you`, `/tickets/${id}`]
      )
    }

    return NextResponse.json({ ok: true, assigned_to_id: userId, assigned_to_email: email })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
