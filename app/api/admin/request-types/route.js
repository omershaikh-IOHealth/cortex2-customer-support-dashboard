import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const solution_id = searchParams.get('solution_id')
    const params = []
    let query = 'SELECT * FROM test.request_types'
    if (solution_id) { params.push(solution_id); query += ' WHERE solution_id = $1' }
    query += ' ORDER BY request_type'
    return NextResponse.json((await pool.query(query, params)).rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { solution_id, request_type, description, sla_applicable } = await request.json()
    const result = await pool.query(`
      INSERT INTO test.request_types (solution_id, request_type, description, sla_applicable)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [solution_id, request_type, description, sla_applicable !== false])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
