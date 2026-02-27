import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const count = Math.min(parseInt(searchParams.get('count') || '10'), 50)
    const priority = searchParams.get('priority')
    const status = searchParams.get('status')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')

    const params = []
    const conditions = [
      "company_id = (SELECT id FROM test.companies WHERE company_code = 'medgulf' LIMIT 1)",
      "(is_deleted = false OR is_deleted IS NULL)",
    ]

    if (priority) { params.push(priority); conditions.push(`priority = $${params.length}`) }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`) }
    if (date_from) { params.push(date_from); conditions.push(`created_at >= $${params.length}`) }
    if (date_to) { params.push(date_to); conditions.push(`created_at <= $${params.length}`) }

    params.push(count)

    const result = await pool.query(`
      SELECT id, clickup_task_id, title, priority, status, sla_status, sla_consumption_pct,
             module, request_type, case_type, created_by_name, created_by_email, created_at, resolved_at
      FROM test.tickets
      WHERE ${conditions.join(' AND ')}
      ORDER BY RANDOM()
      LIMIT $${params.length}
    `, params)

    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
