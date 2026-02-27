import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM test.pocs WHERE company_id = c.id) as poc_count,
        (SELECT COUNT(*) FROM test.solutions WHERE company_id = c.id) as solution_count
      FROM test.companies c
      ORDER BY c.company_name
    `)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { company_code, company_name, description, domain, is_active } = await request.json()
    const result = await pool.query(`
      INSERT INTO test.companies (company_code, company_name, description, domain, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [company_code, company_name, description, domain, is_active !== false])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
