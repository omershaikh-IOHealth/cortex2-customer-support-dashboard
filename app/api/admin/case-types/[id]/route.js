import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { case_type, description, default_priority } = await request.json()
    const result = await pool.query(`
      UPDATE test.case_types SET case_type=$1, description=$2, default_priority=$3 WHERE id=$4 RETURNING *
    `, [case_type, description, default_priority, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.case_types WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
