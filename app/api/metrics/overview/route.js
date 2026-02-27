import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(status) NOT IN ('closed', 'resolved', 'deleted', 'complete', 'completed') AND (is_deleted = false OR is_deleted IS NULL)) as active_tickets,
        COUNT(*) FILTER (WHERE sla_status = 'critical' AND (is_deleted = false OR is_deleted IS NULL)) as critical_sla,
        COUNT(*) FILTER (WHERE escalation_level >= 3 AND (is_deleted = false OR is_deleted IS NULL)) as high_escalations,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND (is_deleted = false OR is_deleted IS NULL)) as tickets_24h,
        ROUND(AVG(sla_consumption_pct) FILTER (WHERE LOWER(sla_status) NOT IN ('resolved', 'not_applicable') AND (is_deleted = false OR is_deleted IS NULL)), 2) as avg_sla_consumption,
        COUNT(*) FILTER (WHERE sla_consumption_pct >= 100 AND (is_deleted = false OR is_deleted IS NULL)) as breached_sla
      FROM test.tickets
      WHERE company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)
    `)
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
