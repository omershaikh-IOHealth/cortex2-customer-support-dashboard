import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { solution_code, solution_name, description, clickup_space_id, clickup_list_id,
            business_hours_start, business_hours_end, timezone, working_days, is_active } = await request.json()
    const result = await pool.query(`
      UPDATE test.solutions
      SET solution_code=$1, solution_name=$2, description=$3, clickup_space_id=$4,
          clickup_list_id=$5, business_hours_start=$6, business_hours_end=$7,
          timezone=$8, working_days=$9, is_active=$10, updated_at=NOW()
      WHERE id=$11 RETURNING *
    `, [solution_code, solution_name, description, clickup_space_id, clickup_list_id,
        business_hours_start, business_hours_end, timezone, working_days, is_active, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.solutions WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
