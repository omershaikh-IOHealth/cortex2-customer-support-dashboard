import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const company_code = searchParams.get('company') || 'all'
    const companyFilter = company_code === 'all'
      ? ''
      : `AND t.company_id = (SELECT id FROM main.companies WHERE company_code = $1 LIMIT 1)`
    const params = company_code === 'all' ? [] : [company_code]

    const result = await pool.query(`
      SELECT
        t.id, t.clickup_task_id, t.title, t.priority, t.status,
        t.sla_consumption_pct, t.sla_status, t.sla_resolution_due,
        t.sla_response_due, t.escalation_level, t.created_at,
        p.name as poc_name
      FROM main.tickets t
      LEFT JOIN main.pocs p ON t.poc_id = p.id
      WHERE t.sla_status IN ('critical', 'at_risk', 'warning', 'breached')
        AND LOWER(t.status) NOT IN ('closed', 'resolved', 'deleted', 'complete', 'cancelled')
        AND (t.is_deleted = false OR t.is_deleted IS NULL)
        ${companyFilter}
      ORDER BY t.sla_consumption_pct DESC
      LIMIT 20
    `, params)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
