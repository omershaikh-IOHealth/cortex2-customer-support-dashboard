import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { auth } from '@/auth'
import { createClickUpTask } from '@/lib/clickup'

// Compute AI similar tickets once after creation (non-blocking)
async function computeSimilarTickets(ticketId, title, description) {
  if (!process.env.CORE42_API_KEY) return
  try {
    const resolved = await pool.query(`
      SELECT id, title, COALESCE(ai_summary, '') AS ai_summary
      FROM main.tickets
      WHERE id != $1
        AND status IN ('closed', 'resolved', 'completed', 'complete')
        AND (is_deleted = false OR is_deleted IS NULL)
      ORDER BY created_at DESC
      LIMIT 100
    `, [ticketId])

    if (resolved.rows.length === 0) return

    const candidates = resolved.rows.map(r => `ID:${r.id} — ${r.title}. ${r.ai_summary}`.slice(0, 200)).join('\n')
    const prompt = `New ticket:\nTitle: ${title}\nDescription: ${(description || '').slice(0, 500)}\n\nResolved tickets:\n${candidates}\n\nReturn a JSON array of the 5 most semantically similar ticket IDs, e.g. [12,34,56]. Only the array, no other text.`

    const res = await fetch('https://api.core42.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CORE42_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    const ids = JSON.parse(content.replace(/```json|```/g, '').trim())
    if (!Array.isArray(ids) || ids.length === 0) return
    await pool.query(
      `UPDATE main.tickets SET similar_ticket_ids = $1 WHERE id = $2`,
      [ids.map(Number).filter(Boolean), ticketId]
    )
  } catch (_) { /* best-effort — no-op on failure */ }
}

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
      channel = 'apex',
      push_to_clickup = true,
    } = body

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    // 1. Insert into DB
    const result = await pool.query(
      `INSERT INTO main.tickets
         (title, description, priority, status, module, request_type, case_type,
          poc_id, company_id, solution_id, created_by_name, created_by_email, channel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [title, description, priority, status, module, request_type, case_type,
       poc_id || null, company_id || null, solution_id || null,
       session.user.name, session.user.email, channel]
    )
    const ticket = result.rows[0]

    // 2. Push to ClickUp (non-blocking)
    // FCR gate: callers must set push_to_clickup=false for FCR call tickets.
    //   FCR call (First-Contact Resolution) → no ClickUp task (ticket closed immediately, no follow-up needed).
    //   Non-FCR call or any other channel → push_to_clickup defaults to true → task created in ClickUp.
    // Example agent usage:
    //   FCR:     POST /api/tickets { channel:'call', push_to_clickup: false }
    //   Non-FCR: POST /api/tickets { channel:'call', push_to_clickup: true  }  ← default
    if (push_to_clickup) {
      const cu = await createClickUpTask(ticket)
      if (cu?.clickup_task_id) {
        await pool.query(
          `UPDATE main.tickets SET clickup_task_id = $1, clickup_url = $2 WHERE id = $3`,
          [cu.clickup_task_id, cu.clickup_url, ticket.id]
        )
        ticket.clickup_task_id = cu.clickup_task_id
        ticket.clickup_url = cu.clickup_url
      }
    }

    // 3. Compute AI similar tickets (non-blocking, best-effort)
    computeSimilarTickets(ticket.id, title, description).catch(() => {})

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
    const assigned_to = searchParams.get('assigned_to')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const company_code = searchParams.get('company') || 'medgulf'
    const params = []
    const conditions = ["(t.is_deleted = false OR t.is_deleted IS NULL)"]

    if (company_code !== 'all') {
      params.push(company_code)
      conditions.push(`t.company_id = (SELECT id FROM main.companies WHERE company_code = $${params.length} LIMIT 1)`)
    }

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
    if (assigned_to) {
      params.push(assigned_to)
      conditions.push(`(t.assigned_to_email = $${params.length} OR t.created_by_email = $${params.length})`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(t.title ILIKE $${params.length} OR CAST(t.id AS TEXT) LIKE $${params.length})`)
    }

    const whereClause = conditions.join(' AND ')
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM main.tickets t WHERE ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].count)

    params.push(limit, offset)

    const result = await pool.query(`
      SELECT
        t.id, t.clickup_task_id, t.clickup_url, t.title, t.description,
        t.status, t.priority, t.request_type, t.case_type, t.module,
        t.sla_consumption_pct, t.sla_status, t.sla_response_due, t.sla_resolution_due,
        t.escalation_level, t.last_escalation_at, t.ai_sentiment,
        t.assigned_to_id, t.assigned_to_email, t.channel,
        t.created_at, t.updated_at, t.created_by_name, t.created_by_email,
        p.name as poc_name, p.email as poc_email, p.is_vip as poc_is_vip,
        (SELECT COUNT(*) FROM main.threads WHERE ticket_id = t.id) as thread_count,
        (SELECT created_at FROM main.threads
         WHERE ticket_id = t.id AND action_type = 'status_change'
         ORDER BY created_at DESC LIMIT 1) as last_status_change_at
      FROM main.tickets t
      LEFT JOIN main.pocs p ON t.poc_id = p.id
      WHERE ${whereClause}
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

    return NextResponse.json({ tickets: result.rows, total })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
