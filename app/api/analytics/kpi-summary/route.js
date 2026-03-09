import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const prevDays = days * 2

    const [current, previous] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                          AS total_tickets,
          COUNT(*) FILTER (WHERE status NOT IN ('complete','Closed'))       AS open_tickets,
          COUNT(*) FILTER (WHERE priority = 'P1'
            AND status NOT IN ('complete','Closed'))                        AS p1_open,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE sla_consumption_pct < 100)
            / NULLIF(COUNT(*), 0), 1
          )                                                                 AS sla_compliance_pct,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE escalation_level > 0)
            / NULLIF(COUNT(*), 0), 1
          )                                                                 AS escalation_rate_pct,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE ai_sentiment = 'negative')
            / NULLIF(COUNT(*), 0), 1
          )                                                                 AS neg_sentiment_pct,
          ROUND(AVG(
            CASE WHEN resolved_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0
            END
          )::numeric, 1)                                                    AS avg_resolution_hours
        FROM main.tickets
        WHERE company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
          AND (is_deleted = false OR is_deleted IS NULL)
          AND created_at >= NOW() - ($1 || ' days')::interval
      `, [days]),

      pool.query(`
        SELECT
          COUNT(*)                                                          AS total_tickets,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE sla_consumption_pct < 100)
            / NULLIF(COUNT(*), 0), 1
          )                                                                 AS sla_compliance_pct,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE escalation_level > 0)
            / NULLIF(COUNT(*), 0), 1
          )                                                                 AS escalation_rate_pct,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE ai_sentiment = 'negative')
            / NULLIF(COUNT(*), 0), 1
          )                                                                 AS neg_sentiment_pct,
          ROUND(AVG(
            CASE WHEN resolved_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0
            END
          )::numeric, 1)                                                    AS avg_resolution_hours
        FROM main.tickets
        WHERE company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
          AND (is_deleted = false OR is_deleted IS NULL)
          AND created_at >= NOW() - ($1 || ' days')::interval
          AND created_at < NOW() - ($2 || ' days')::interval
      `, [prevDays, days]),
    ])

    const curr = current.rows[0]
    const prev = previous.rows[0]

    function delta(a, b) {
      const av = parseFloat(a) || 0
      const bv = parseFloat(b) || 0
      if (bv === 0) return null
      return Math.round(((av - bv) / bv) * 100)
    }

    return NextResponse.json({
      current: curr,
      previous: prev,
      deltas: {
        total_tickets:      delta(curr.total_tickets, prev.total_tickets),
        sla_compliance_pct: delta(curr.sla_compliance_pct, prev.sla_compliance_pct),
        escalation_rate_pct: delta(curr.escalation_rate_pct, prev.escalation_rate_pct),
        neg_sentiment_pct:  delta(curr.neg_sentiment_pct, prev.neg_sentiment_pct),
        avg_resolution_hours: delta(curr.avg_resolution_hours, prev.avg_resolution_hours),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
