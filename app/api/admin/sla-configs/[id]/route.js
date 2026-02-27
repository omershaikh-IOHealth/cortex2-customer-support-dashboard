import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { priority_name, priority_description, response_hours, resolution_hours, resolution_type } = await request.json()
    const result = await pool.query(`
      UPDATE test.sla_configs
      SET priority_name=$1, priority_description=$2, response_hours=$3, resolution_hours=$4, resolution_type=$5
      WHERE id=$6 RETURNING *
    `, [priority_name, priority_description, response_hours, resolution_hours, resolution_type, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.sla_configs WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
