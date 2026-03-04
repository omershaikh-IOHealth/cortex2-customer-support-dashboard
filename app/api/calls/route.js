import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// POST — log a completed call (called by ZiwoWidget after hangup)
export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      primary_call_id,
      agent_call_id,
      direction = 'inbound',
      customer_number,
      queue_name,
      duration_secs = 0,
      hangup_cause,
      status = 'ended',
      started_at,
    } = body

    // Upsert by primary_call_id so duplicate POSTs are safe
    const result = await pool.query(
      `INSERT INTO main.call_logs
         (primary_call_id, agent_call_id, agent_id, direction, customer_number,
          queue_name, duration_secs, hangup_cause, status, started_at, ended_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
               COALESCE($10::TIMESTAMP, NOW()),
               NOW())
       ON CONFLICT (primary_call_id) DO UPDATE SET
         status        = EXCLUDED.status,
         duration_secs = EXCLUDED.duration_secs,
         hangup_cause  = EXCLUDED.hangup_cause,
         ended_at      = NOW()
       RETURNING id, primary_call_id, direction, duration_secs, status`,
      [
        primary_call_id || `cortex-${Date.now()}`,
        agent_call_id || null,
        session.user.id,
        direction,
        customer_number || null,
        queue_name || null,
        duration_secs,
        hangup_cause || null,
        status,
        started_at || null,
      ]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — call history (admin sees all, agent sees their own)
export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')
    const direction = searchParams.get('direction')
    const agentId = searchParams.get('agent_id')
    const hasTicket = searchParams.get('has_ticket') // 'yes' | 'no'

    const conditions = []
    const params = []
    let i = 1

    // Agents only see their own calls
    if (session.user.role !== 'admin') {
      conditions.push(`c.agent_id = $${i++}`)
      params.push(session.user.id)
    } else if (agentId) {
      conditions.push(`c.agent_id = $${i++}`)
      params.push(agentId)
    }
    if (direction) {
      conditions.push(`c.direction = $${i++}`)
      params.push(direction)
    }
    if (hasTicket === 'yes') conditions.push('c.ticket_id IS NOT NULL')
    if (hasTicket === 'no') conditions.push('c.ticket_id IS NULL')

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit, offset)

    const result = await pool.query(
      `SELECT c.id, c.primary_call_id, c.direction, c.customer_number,
              c.duration_secs, c.talk_time_secs, c.hangup_cause, c.status,
              c.started_at, c.ended_at, c.ticket_id,
              u.full_name as agent_name, u.email as agent_email,
              t.id as ticket_ref, t.title as ticket_title, t.status as ticket_status
       FROM main.call_logs c
       LEFT JOIN main.users u ON c.agent_id = u.id
       LEFT JOIN main.tickets t ON c.ticket_id = t.id
       ${where}
       ORDER BY c.started_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      params
    )

    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
