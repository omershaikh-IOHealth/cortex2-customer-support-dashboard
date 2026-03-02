import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { getClickUpMembers, updateClickUpTask } from '@/lib/clickup'

// POST — assign ticket to an agent
// Body: { assigned_to_id, assigned_to_email }
export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const { assigned_to_id, assigned_to_email } = await request.json()

  if (!assigned_to_id && !assigned_to_email)
    return NextResponse.json({ error: 'assigned_to_id or assigned_to_email required' }, { status: 400 })

  try {
    // Resolve email from id if not provided
    let email = assigned_to_email
    let userId = assigned_to_id

    if (userId && !email) {
      const u = await pool.query('SELECT email FROM main.users WHERE id = $1', [userId])
      email = u.rows[0]?.email
    } else if (email && !userId) {
      const u = await pool.query('SELECT id FROM main.users WHERE email = $1', [email])
      userId = u.rows[0]?.id
    }

    await pool.query(
      `UPDATE main.tickets
       SET assigned_to_id = $1, assigned_to_email = $2
       WHERE id = $3`,
      [userId, email, id]
    )

    // Log assignment in threads
    await pool.query(
      `INSERT INTO main.threads (ticket_id, action_type, thread_source, notes, created_by_email)
       VALUES ($1, 'assignment', 'internal', $2, $3)`,
      [id, `Assigned to ${email}`, session.user.email]
    )

    // Notify the assigned agent
    if (userId) {
      await pool.query(
        `INSERT INTO main.notifications (user_id, type, title, body, link)
         VALUES ($1, 'assignment', 'Ticket Assigned', $2, $3)`,
        [userId, `Ticket #${id} has been assigned to you`, `/my-tickets/${id}`]
      )
    }

    // Sync assignee to ClickUp (best-effort, non-blocking)
    if (email) {
      const ticketRow = await pool.query(
        'SELECT clickup_task_id FROM main.tickets WHERE id = $1',
        [id]
      )
      const clickupTaskId = ticketRow.rows[0]?.clickup_task_id
      if (clickupTaskId) {
        getClickUpMembers().then(members => {
          const match = members.find(m => m.email === email)
          if (match) {
            updateClickUpTask(clickupTaskId, { assignees: [match.id] }).catch(() => {})
          }
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, assigned_to_id: userId, assigned_to_email: email })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
