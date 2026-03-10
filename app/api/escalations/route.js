import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        sa.id, sa.ticket_id, sa.alert_level, sa.consumption_pct,
        sa.notified_emails, sa.notification_channel, sa.created_at,
        sa.is_acknowledged, sa.acknowledged_by, sa.acknowledged_at,
        t.title, t.priority, t.clickup_task_id
      FROM main.sla_alerts sa
      JOIN main.tickets t ON sa.ticket_id = t.id
      WHERE t.company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND (t.is_deleted = false OR t.is_deleted IS NULL)
      ORDER BY sa.created_at DESC
      LIMIT 50
    `)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
