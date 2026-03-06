import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.clickup_task_id,
        t.title,
        t.priority,
        t.status,
        t.sla_consumption_pct,
        t.sla_status,
        t.module,
        t.created_by_name,
        t.created_at,
        t.qa_flag_reason,
        t.qa_flagged_at,
        u.full_name AS qa_flagged_by_name,
        u.email     AS qa_flagged_by_email
      FROM main.tickets t
      LEFT JOIN main.users u ON u.id = t.qa_flagged_by
      WHERE t.flag_for_qa = true
        AND t.company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND (t.is_deleted = false OR t.is_deleted IS NULL)
      ORDER BY t.qa_flagged_at DESC
    `)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
