import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// POST — manually escalate a ticket one level
export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const body = await request.json().catch(() => ({}))
  const reason = body.reason || 'Manual escalation'

  try {
    const ticketRes = await pool.query(
      `SELECT id, escalation_level, company_code FROM test.tickets WHERE id = $1`,
      [id]
    )
    if (ticketRes.rows.length === 0)
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    const ticket = ticketRes.rows[0]
    const newLevel = (ticket.escalation_level || 0) + 1

    await pool.query(
      `UPDATE test.tickets SET escalation_level = $1 WHERE id = $2`,
      [newLevel, id]
    )

    // Log in threads
    await pool.query(
      `INSERT INTO test.threads (ticket_id, action_type, thread_source, notes, created_by_email)
       VALUES ($1, 'escalation', 'internal', $2, $3)`,
      [id, `Escalated to Level ${newLevel}: ${reason}`, session.user.email]
    )

    // Create SLA alert
    await pool.query(
      `INSERT INTO test.sla_alerts (ticket_id, alert_level, notification_channel, notified_emails, acknowledged)
       VALUES ($1, $2, 'internal', ARRAY[$3], false)`,
      [id, newLevel, session.user.email]
    ).catch(() => {}) // non-fatal if sla_alerts schema differs

    return NextResponse.json({ ok: true, escalation_level: newLevel })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
