import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { role_code, role_name, person_name, email, clickup_user_id, is_active } = await request.json()
    const result = await pool.query(`
      UPDATE test.assignee_configs
      SET role_code=$1, role_name=$2, person_name=$3, email=$4, clickup_user_id=$5, is_active=$6
      WHERE id=$7 RETURNING *
    `, [role_code, role_name, person_name, email, clickup_user_id, is_active, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.assignee_configs WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
