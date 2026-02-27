import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { module_code, module_name, description } = await request.json()
    const result = await pool.query(`
      UPDATE test.modules SET module_code=$1, module_name=$2, description=$3 WHERE id=$4 RETURNING *
    `, [module_code, module_name, description, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.modules WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
