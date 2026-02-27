import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const solution_id = searchParams.get('solution_id')
    const params = []
    let query = 'SELECT * FROM test.assignee_configs'
    if (solution_id) { params.push(solution_id); query += ' WHERE solution_id = $1' }
    query += ' ORDER BY role_code, person_name'
    return NextResponse.json((await pool.query(query, params)).rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { solution_id, role_code, role_name, person_name, email, clickup_user_id, is_active } = await request.json()
    const result = await pool.query(`
      INSERT INTO test.assignee_configs (solution_id, role_code, role_name, person_name, email, clickup_user_id, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [solution_id, role_code, role_name, person_name, email, clickup_user_id, is_active !== false])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
