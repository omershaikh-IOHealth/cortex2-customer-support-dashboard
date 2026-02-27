import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const params = []
    let query = 'SELECT p.*, c.company_name FROM test.pocs p LEFT JOIN test.companies c ON p.company_id = c.id'
    if (company_id) { params.push(company_id); query += ' WHERE p.company_id = $1' }
    query += ' ORDER BY p.name'
    const result = await pool.query(query, params)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { company_id, email, name, phone, role, status, is_primary } = await request.json()
    const result = await pool.query(`
      INSERT INTO test.pocs (company_id, email, name, phone, role, status, is_primary, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [company_id, email, name, phone, role, status || 'active', is_primary || false])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
