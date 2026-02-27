import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.clickup_task_id, t.title, t.priority, t.status,
        t.sla_consumption_pct, t.sla_status, t.sla_resolution_due,
        t.sla_response_due, t.escalation_level, t.created_at,
        p.name as poc_name
      FROM test.tickets t
      LEFT JOIN test.pocs p ON t.poc_id = p.id
      WHERE t.sla_status IN ('critical', 'at_risk', 'warning', 'breached')
        AND t.status NOT IN ('closed', 'resolved', 'deleted')
        AND (t.is_deleted = false OR t.is_deleted IS NULL)
      ORDER BY t.sla_consumption_pct DESC
      LIMIT 20
    `)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
