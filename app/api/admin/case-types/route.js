import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const solution_id = searchParams.get('solution_id')
    const request_type_id = searchParams.get('request_type_id')
    const params = []
    let query = `
      SELECT ct.*, rt.request_type FROM test.case_types ct
      LEFT JOIN test.request_types rt ON ct.request_type_id = rt.id
      WHERE 1=1
    `
    if (solution_id) { params.push(solution_id); query += ` AND ct.solution_id = $${params.length}` }
    if (request_type_id) { params.push(request_type_id); query += ` AND ct.request_type_id = $${params.length}` }
    query += ' ORDER BY ct.case_type'
    return NextResponse.json((await pool.query(query, params)).rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { solution_id, request_type_id, case_type, description, default_priority } = await request.json()
    const result = await pool.query(`
      INSERT INTO test.case_types (solution_id, request_type_id, case_type, description, default_priority)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [solution_id, request_type_id, case_type, description, default_priority])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
