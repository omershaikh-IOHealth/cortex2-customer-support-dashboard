import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { auth } from '@/auth.config'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId  = searchParams.get('agent_id')
    const result_  = searchParams.get('result')
    const limit    = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const ticketId = searchParams.get('ticket_id')

    const conditions = [`qs.company_code = 'medgulf'`]
    const params = []

    if (agentId)  { params.push(agentId);  conditions.push(`qs.agent_id = $${params.length}`) }
    if (result_)  { params.push(result_);  conditions.push(`qs.result = $${params.length}`) }
    if (ticketId) { params.push(ticketId); conditions.push(`qs.ticket_id = $${params.length}`) }

    params.push(limit)

    const result = await pool.query(`
      SELECT
        qs.id,
        qs.ticket_id,
        qs.agent_id,
        qs.reviewer_id,
        qs.scores,
        qs.critical_flags,
        qs.coaching_notes,
        qs.follow_up_action,
        qs.follow_up_date,
        qs.supervisor_id,
        qs.improvement_themes,
        qs.total_score,
        qs.result,
        qs.reviewed_at,
        qs.created_at,
        -- Joins
        t.clickup_task_id,
        t.title       AS ticket_title,
        t.priority    AS ticket_priority,
        t.status      AS ticket_status,
        t.channel     AS ticket_channel,
        t.module      AS ticket_module,
        t.sla_consumption_pct,
        t.created_by_name AS customer_name,
        agent.full_name   AS agent_name,
        agent.email       AS agent_email,
        reviewer.full_name AS reviewer_name,
        sup.full_name      AS supervisor_name
      FROM main.qa_scores qs
      JOIN main.tickets t     ON t.id = qs.ticket_id
      JOIN main.users agent   ON agent.id = qs.agent_id
      JOIN main.users reviewer ON reviewer.id = qs.reviewer_id
      LEFT JOIN main.users sup ON sup.id = qs.supervisor_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY qs.reviewed_at DESC
      LIMIT $${params.length}
    `, params)

    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      ticket_id,
      agent_id,
      scores,
      critical_flags,
      coaching_notes,
      follow_up_action,
      follow_up_date,
      supervisor_id,
      improvement_themes,
      total_score,
      result,
    } = body

    if (!ticket_id || !agent_id || !result) {
      return NextResponse.json({ error: 'ticket_id, agent_id, and result are required' }, { status: 400 })
    }

    const reviewer_id = session.user.id

    const insertResult = await pool.query(`
      INSERT INTO main.qa_scores (
        ticket_id, agent_id, reviewer_id, company_code,
        scores, critical_flags, coaching_notes, follow_up_action, follow_up_date,
        supervisor_id, improvement_themes, total_score, result, reviewed_at
      ) VALUES (
        $1, $2, $3, 'medgulf',
        $4, $5, $6, $7, $8,
        $9, $10, $11, $12, NOW()
      )
      RETURNING id, total_score, result, reviewed_at
    `, [
      ticket_id, agent_id, reviewer_id,
      JSON.stringify(scores || {}),
      JSON.stringify(critical_flags || {}),
      coaching_notes || null,
      follow_up_action || null,
      follow_up_date || null,
      supervisor_id || null,
      JSON.stringify(improvement_themes || []),
      total_score,
      result,
    ])

    return NextResponse.json(insertResult.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
