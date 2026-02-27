import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const params = []
    let query = `
      SELECT s.*, c.company_name,
        (SELECT COUNT(*) FROM test.sla_configs WHERE solution_id = s.id) as sla_count,
        (SELECT COUNT(*) FROM test.modules WHERE solution_id = s.id) as module_count
      FROM test.solutions s
      LEFT JOIN test.companies c ON s.company_id = c.id
    `
    if (company_id) { params.push(company_id); query += ' WHERE s.company_id = $1' }
    query += ' ORDER BY s.solution_name'
    const result = await pool.query(query, params)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { company_id, solution_code, solution_name, description, clickup_space_id, clickup_list_id,
            business_hours_start, business_hours_end, timezone, working_days, is_active } = await request.json()
    const result = await pool.query(`
      INSERT INTO test.solutions (company_id, solution_code, solution_name, description, clickup_space_id, clickup_list_id,
        business_hours_start, business_hours_end, timezone, working_days, is_active, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *
    `, [company_id, solution_code, solution_name, description, clickup_space_id, clickup_list_id,
        business_hours_start || '08:00', business_hours_end || '20:00', timezone || 'Asia/Dubai',
        working_days || [0,1,2,3,4,5,6], is_active !== false])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
