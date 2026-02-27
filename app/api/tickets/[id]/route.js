import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { auth } from '@/auth'
import { updateClickUpTask } from '@/lib/clickup'

// PUT — update a ticket (syncs to DB + ClickUp)
export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = params
    const body = await request.json()
    const { title, description, priority, status, module, request_type, case_type } = body

    const sets = []
    const vals = []
    let i = 1

    if (title !== undefined)        { sets.push(`title = $${i++}`); vals.push(title) }
    if (description !== undefined)  { sets.push(`description = $${i++}`); vals.push(description) }
    if (priority !== undefined)     { sets.push(`priority = $${i++}`); vals.push(priority) }
    if (status !== undefined)       { sets.push(`status = $${i++}`); vals.push(status) }
    if (module !== undefined)       { sets.push(`module = $${i++}`); vals.push(module) }
    if (request_type !== undefined) { sets.push(`request_type = $${i++}`); vals.push(request_type) }
    if (case_type !== undefined)    { sets.push(`case_type = $${i++}`); vals.push(case_type) }

    if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    sets.push(`updated_at = NOW()`)
    vals.push(id)

    const result = await pool.query(
      `UPDATE test.tickets SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, title, status, priority, clickup_task_id, clickup_url, updated_at`,
      vals
    )
    if (result.rows.length === 0) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    const ticket = result.rows[0]

    // Sync changes to ClickUp (best-effort)
    if (ticket.clickup_task_id) {
      await updateClickUpTask(ticket.clickup_task_id, { title, status, priority, description })
    }

    // Log status change to threads
    if (status) {
      await pool.query(
        `INSERT INTO test.threads (ticket_id, action_type, actor_email, actor_name, new_value, thread_source)
         VALUES ($1, 'status_change', $2, $3, $4, 'internal')`,
        [id, session.user.email, session.user.name, status]
      ).catch(() => {}) // Don't fail ticket update if thread insert fails
    }

    return NextResponse.json(ticket)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = params

    const [ticketResult, threadsResult, alertsResult] = await Promise.all([
      pool.query(`
        SELECT t.*, p.name as poc_name, p.email as poc_email, p.phone as poc_phone,
               c.company_name, c.company_code, s.solution_name, s.solution_code
        FROM test.tickets t
        LEFT JOIN test.pocs p ON t.poc_id = p.id
        LEFT JOIN test.companies c ON t.company_id = c.id
        LEFT JOIN test.solutions s ON t.solution_id = s.id
        WHERE t.id = $1
      `, [id]),
      pool.query(
        'SELECT * FROM test.threads WHERE ticket_id = $1 ORDER BY created_at ASC',
        [id]
      ),
      pool.query(
        'SELECT * FROM test.sla_alerts WHERE ticket_id = $1 ORDER BY created_at DESC',
        [id]
      ),
    ])

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({
      ticket: ticketResult.rows[0],
      threads: threadsResult.rows,
      alerts: alertsResult.rows,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
