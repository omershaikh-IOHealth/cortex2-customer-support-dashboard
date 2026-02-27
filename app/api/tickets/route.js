import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { auth } from '@/auth'
import { createClickUpTask } from '@/lib/clickup'

// POST — create a ticket from Cortex (syncs to DB + ClickUp)
export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      title, description, priority = 'P3', status = 'Open',
      module, request_type, case_type,
      poc_id, company_id, solution_id,
    } = body

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    // 1. Insert into DB
    const result = await pool.query(
      `INSERT INTO test.tickets
         (title, description, priority, status, module, request_type, case_type,
          poc_id, company_id, solution_id, created_by_name, created_by_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [title, description, priority, status, module, request_type, case_type,
       poc_id || null, company_id || null, solution_id || null,
       session.user.name, session.user.email]
    )
    const ticket = result.rows[0]

    // 2. Push to ClickUp (non-blocking — don't fail if ClickUp is unavailable)
    const cu = await createClickUpTask(ticket)
    if (cu?.clickup_task_id) {
      await pool.query(
        `UPDATE test.tickets SET clickup_task_id = $1, clickup_url = $2 WHERE id = $3`,
        [cu.clickup_task_id, cu.clickup_url, ticket.id]
      )
      ticket.clickup_task_id = cu.clickup_task_id
      ticket.clickup_url = cu.clickup_url
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const sla_status = searchParams.get('sla_status')
    const escalation_level = searchParams.get('escalation_level')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const params = []
    const conditions = [
      "t.company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)",
      "(t.is_deleted = false OR t.is_deleted IS NULL)",
    ]

    if (status) {
      params.push(status)
      conditions.push(`t.status = $${params.length}`)
    }
    if (priority) {
      params.push(priority)
      conditions.push(`t.priority = $${params.length}`)
    }
    if (sla_status) {
      params.push(sla_status)
      conditions.push(`t.sla_status = $${params.length}`)
    }
    if (escalation_level) {
      params.push(parseInt(escalation_level))
      conditions.push(`t.escalation_level >= $${params.length}`)
    }

    params.push(limit, offset)

    const result = await pool.query(`
      SELECT
        t.id, t.clickup_task_id, t.clickup_url, t.title, t.description,
        t.status, t.priority, t.request_type, t.case_type, t.module,
        t.sla_consumption_pct, t.sla_status, t.sla_response_due, t.sla_resolution_due,
        t.escalation_level, t.last_escalation_at, t.ai_sentiment,
        t.created_at, t.updated_at, t.created_by_name, t.created_by_email,
        p.name as poc_name, p.email as poc_email,
        (SELECT COUNT(*) FROM test.threads WHERE ticket_id = t.id) as thread_count,
        (SELECT created_at FROM test.threads
         WHERE ticket_id = t.id AND action_type = 'status_change'
         ORDER BY created_at DESC LIMIT 1) as last_status_change_at
      FROM test.tickets t
      LEFT JOIN test.pocs p ON t.poc_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE
          WHEN t.sla_status = 'critical' THEN 1
          WHEN t.sla_status = 'at_risk' THEN 2
          WHEN t.escalation_level >= 3 THEN 3
          ELSE 4
        END,
        t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
