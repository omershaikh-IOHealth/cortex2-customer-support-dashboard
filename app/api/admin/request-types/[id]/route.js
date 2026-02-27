import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { request_type, description, sla_applicable } = await request.json()
    const result = await pool.query(`
      UPDATE test.request_types SET request_type=$1, description=$2, sla_applicable=$3 WHERE id=$4 RETURNING *
    `, [request_type, description, sla_applicable, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.request_types WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
