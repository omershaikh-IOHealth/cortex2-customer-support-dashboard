import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const solution_id = searchParams.get('solution_id')
    const params = []
    let query = 'SELECT * FROM test.escalation_configs'
    if (solution_id) { params.push(solution_id); query += ' WHERE solution_id = $1' }
    query += ' ORDER BY level'
    return NextResponse.json((await pool.query(query, params)).rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { solution_id, level, threshold_percent, level_name, notify_roles, action_description } = await request.json()
    const result = await pool.query(`
      INSERT INTO test.escalation_configs (solution_id, level, threshold_percent, level_name, notify_roles, action_description)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [solution_id, level, threshold_percent, level_name, notify_roles, action_description])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
