import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const solution_id = searchParams.get('solution_id')
    const params = []
    let query = 'SELECT * FROM test.sla_configs'
    if (solution_id) { params.push(solution_id); query += ' WHERE solution_id = $1' }
    query += ' ORDER BY priority'
    return NextResponse.json((await pool.query(query, params)).rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { solution_id, priority, priority_name, priority_description, response_hours, resolution_hours, resolution_type } = await request.json()
    const result = await pool.query(`
      INSERT INTO test.sla_configs (solution_id, priority, priority_name, priority_description, response_hours, resolution_hours, resolution_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [solution_id, priority, priority_name, priority_description, response_hours, resolution_hours, resolution_type || 'hours'])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
