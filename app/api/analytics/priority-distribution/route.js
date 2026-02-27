import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        priority,
        COUNT(*) as count,
        ROUND(AVG(sla_consumption_pct), 2) as avg_sla_consumption,
        ROUND(AVG(
          CASE WHEN resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0
          END
        )::numeric, 1) as avg_resolution_hours
      FROM test.tickets
      WHERE company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND (is_deleted = false OR is_deleted IS NULL)
      GROUP BY priority
      ORDER BY priority
    `)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
