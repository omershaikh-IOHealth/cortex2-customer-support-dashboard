import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET /api/calls/metrics/agent?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
// Returns comprehensive agent performance metrics for the given date range.
// Agents see their own metrics; admins can pass agent_id param to view any agent.
export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const today = new Date().toISOString().split('T')[0]
  const date_from = searchParams.get('date_from') || today
  const date_to = searchParams.get('date_to') || today
  const agent_id_param = searchParams.get('agent_id')

  // Determine which agent to query
  let agentId
  if (session.user.role === 'admin' && agent_id_param) {
    agentId = parseInt(agent_id_param)
  } else {
    agentId = session.user.id
  }

  try {
    // Date range as timestamps (inclusive, full day)
    const rangeStart = `${date_from} 00:00:00`
    const rangeEnd = `${date_to} 23:59:59`

    // ── 1. Call metrics ──────────────────────────────────────────────────────
    const callsResult = await pool.query(`
      SELECT
        COUNT(*)                                                        AS total_calls,
        COUNT(*) FILTER (WHERE direction = 'inbound')                  AS total_inbound,
        COUNT(*) FILTER (
          WHERE direction = 'inbound'
            AND hangup_cause NOT IN ('missed', 'caller_cancel', 'originator_cancel', 'no_answer')
            AND duration_secs > 0
        )                                                               AS inbound_answered,
        COUNT(*) FILTER (
          WHERE direction = 'inbound'
            AND (
              hangup_cause IN ('missed', 'caller_cancel', 'originator_cancel', 'no_answer')
              OR duration_secs = 0
            )
        )                                                               AS missed_calls,
        COUNT(*) FILTER (WHERE direction = 'outbound')                 AS outbound_calls,
        ROUND(AVG(duration_secs) FILTER (
          WHERE direction = 'inbound'
            AND hangup_cause NOT IN ('missed', 'caller_cancel', 'originator_cancel', 'no_answer')
            AND duration_secs > 0
        ))                                                              AS aht_seconds,
        COUNT(*) FILTER (WHERE fcr = true)                             AS fcr_count,
        SUM(duration_secs) FILTER (WHERE direction = 'inbound' AND duration_secs > 0) AS total_talk_secs
      FROM main.call_logs
      WHERE agent_id = $1
        AND started_at BETWEEN $2 AND $3
    `, [agentId, rangeStart, rangeEnd])

    const callMetrics = callsResult.rows[0]
    const totalInbound = parseInt(callMetrics.total_inbound) || 0
    const inboundAnswered = parseInt(callMetrics.inbound_answered) || 0
    const missedCalls = parseInt(callMetrics.missed_calls) || 0
    const fcrCount = parseInt(callMetrics.fcr_count) || 0
    const fcrRate = inboundAnswered > 0 ? Math.round((fcrCount / inboundAnswered) * 100) : 0
    const ahtSeconds = parseInt(callMetrics.aht_seconds) || 0
    const totalTalkSecs = parseInt(callMetrics.total_talk_secs) || 0

    // ── 2. Team-wide abandoned % (all agents, same date range) ──────────────
    const abandonedResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE direction = 'inbound') AS team_total_inbound,
        COUNT(*) FILTER (
          WHERE direction = 'inbound'
            AND (
              hangup_cause IN ('missed', 'caller_cancel', 'originator_cancel', 'no_answer')
              OR duration_secs = 0
            )
        ) AS team_missed
      FROM main.call_logs
      WHERE started_at BETWEEN $1 AND $2
    `, [rangeStart, rangeEnd])

    const teamInbound = parseInt(abandonedResult.rows[0].team_total_inbound) || 0
    const teamMissed = parseInt(abandonedResult.rows[0].team_missed) || 0
    const abandonedPct = teamInbound > 0 ? Math.round((teamMissed / teamInbound) * 100) : 0

    // ── 3. Tickets created & closed ─────────────────────────────────────────
    const ticketsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at BETWEEN $2 AND $3) AS tickets_created,
        COUNT(*) FILTER (
          WHERE status IN ('completed', 'closed', 'resolved')
            AND updated_at BETWEEN $2 AND $3
        ) AS tickets_closed
      FROM main.tickets
      WHERE created_by_email = (SELECT email FROM main.users WHERE id = $1)
        AND (is_deleted = false OR is_deleted IS NULL)
    `, [agentId, rangeStart, rangeEnd])

    const ticketsCreated = parseInt(ticketsResult.rows[0].tickets_created) || 0
    const ticketsClosed = parseInt(ticketsResult.rows[0].tickets_closed) || 0

    // ── 4. Status history for adherence, occupancy, wrap-up ────────────────
    const statusResult = await pool.query(`
      SELECT
        status,
        EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) AS duration_secs
      FROM main.agent_status_history
      WHERE user_id = $1
        AND started_at BETWEEN $2 AND $3
    `, [agentId, rangeStart, rangeEnd])

    let activeStatusSecs = 0   // available + on_call + busy
    let wrapUpSecs = 0
    let totalLoggedSecs = 0
    const wrapUpEntries = []

    for (const row of statusResult.rows) {
      const secs = parseFloat(row.duration_secs) || 0
      totalLoggedSecs += secs
      if (['available', 'busy', 'wrap_up'].includes(row.status)) activeStatusSecs += secs
      if (row.status === 'wrap_up') {
        wrapUpSecs += secs
        wrapUpEntries.push(secs)
      }
    }

    // Adherence: (available + busy + wrap_up) / total logged time × 100
    const adherenceRate = totalLoggedSecs > 0
      ? Math.min(100, Math.round((activeStatusSecs / totalLoggedSecs) * 100))
      : null

    // Wrap-up avg
    const wrapUpAvgSecs = wrapUpEntries.length > 0
      ? Math.round(wrapUpEntries.reduce((a, b) => a + b, 0) / wrapUpEntries.length)
      : 0

    // Occupancy: (talk time + wrap-up time) / total logged time × 100
    const occupancyNumerator = totalTalkSecs + wrapUpSecs
    const occupancyRate = totalLoggedSecs > 0
      ? Math.min(100, Math.round((occupancyNumerator / totalLoggedSecs) * 100))
      : null

    // ── 5. QA score average ──────────────────────────────────────────────────
    const qaResult = await pool.query(`
      SELECT ROUND(AVG(total_score)) AS qa_score_avg, COUNT(*) AS qa_count
      FROM main.qa_scores
      WHERE agent_id = $1
        AND reviewed_at BETWEEN $2 AND $3
    `, [agentId, rangeStart, rangeEnd])

    const qaScoreAvg = qaResult.rows[0].qa_score_avg
      ? parseInt(qaResult.rows[0].qa_score_avg)
      : null
    const qaCount = parseInt(qaResult.rows[0].qa_count) || 0

    // ── 6. Calls by hour (for current agent on the date range) ───────────────
    const byHourResult = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM started_at)::int AS hour,
        COUNT(*)                           AS total,
        COUNT(*) FILTER (
          WHERE direction = 'inbound'
            AND hangup_cause NOT IN ('missed', 'caller_cancel', 'originator_cancel', 'no_answer')
            AND duration_secs > 0
        )                                  AS answered
      FROM main.call_logs
      WHERE agent_id = $1
        AND started_at BETWEEN $2 AND $3
      GROUP BY hour
      ORDER BY hour
    `, [agentId, rangeStart, rangeEnd])

    // Build full 0-23 hour map
    const hourMap = {}
    for (let h = 0; h < 24; h++) hourMap[h] = { hour: h, total: 0, answered: 0 }
    for (const row of byHourResult.rows) {
      hourMap[row.hour] = { hour: parseInt(row.hour), total: parseInt(row.total), answered: parseInt(row.answered) }
    }
    const callsByHour = Object.values(hourMap)

    // ── 7. Recent calls summary (last 5) ────────────────────────────────────
    const recentResult = await pool.query(`
      SELECT
        cl.id, cl.direction, cl.customer_number, cl.customer_name,
        cl.duration_secs, cl.hangup_cause, cl.started_at, cl.fcr,
        cd.name AS disposition
      FROM main.call_logs cl
      LEFT JOIN main.call_dispositions cd ON cl.disposition_id = cd.id
      WHERE cl.agent_id = $1
      ORDER BY cl.started_at DESC
      LIMIT 5
    `, [agentId])

    return NextResponse.json({
      date_from,
      date_to,
      agent_id: agentId,
      // Call metrics
      total_calls: parseInt(callMetrics.total_calls) || 0,
      total_inbound: totalInbound,
      inbound_answered: inboundAnswered,
      missed_calls: missedCalls,
      outbound_calls: parseInt(callMetrics.outbound_calls) || 0,
      aht_seconds: ahtSeconds,
      fcr_count: fcrCount,
      fcr_rate: fcrRate,
      // Team metric
      abandoned_pct: abandonedPct,
      team_total_inbound: teamInbound,
      // Tickets
      tickets_created: ticketsCreated,
      tickets_closed: ticketsClosed,
      // Status-based
      adherence_rate: adherenceRate,
      occupancy_rate: occupancyRate,
      wrap_up_avg_secs: wrapUpAvgSecs,
      total_logged_secs: Math.round(totalLoggedSecs),
      // QA
      qa_score_avg: qaScoreAvg,
      qa_count: qaCount,
      // Charts
      calls_by_hour: callsByHour,
      recent_calls: recentResult.rows,
    })
  } catch (e) {
    console.error('[agent metrics]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
