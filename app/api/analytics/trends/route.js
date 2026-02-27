import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    const solutionId = searchParams.get('solution_id')
    const priority = searchParams.get('priority')

    // Build dynamic WHERE clauses
    const baseWhere = `
      company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)
      AND (is_deleted = false OR is_deleted IS NULL)
      ${companyId ? `AND poc_id IN (SELECT id FROM test.pocs WHERE company_id = ${parseInt(companyId)})` : ''}
      ${solutionId ? `AND solution_id = ${parseInt(solutionId)}` : ''}
      ${priority ? `AND priority = '${priority.replace(/[^A-Za-z0-9]/g, '')}'` : ''}
    `

    const [currentResult, previousResult] = await Promise.all([
      pool.query(`
        WITH daily_stats AS (
          SELECT
            DATE(created_at) as date,
            COUNT(*) as total_tickets,
            COUNT(*) FILTER (WHERE priority IN ('P1', 'P2')) as high_priority,
            COUNT(*) FILTER (WHERE sla_consumption_pct >= 100) as breached,
            ROUND(AVG(sla_consumption_pct), 2) as avg_consumption
          FROM test.tickets
          WHERE ${baseWhere}
            AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        )
        SELECT * FROM daily_stats
      `),
      pool.query(`
        WITH daily_stats AS (
          SELECT
            DATE(created_at) as date,
            COUNT(*) as total_tickets,
            COUNT(*) FILTER (WHERE priority IN ('P1', 'P2')) as high_priority,
            COUNT(*) FILTER (WHERE sla_consumption_pct >= 100) as breached,
            ROUND(AVG(sla_consumption_pct), 2) as avg_consumption,
            (DATE(created_at) - (NOW() - INTERVAL '60 days')::date) as day_index
          FROM test.tickets
          WHERE ${baseWhere}
            AND created_at >= NOW() - INTERVAL '60 days'
            AND created_at < NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        )
        SELECT * FROM daily_stats
      `),
    ])

    return NextResponse.json({
      current: currentResult.rows,
      previous: previousResult.rows,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
