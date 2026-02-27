import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { threshold_percent, level_name, notify_roles, action_description } = await request.json()
    const result = await pool.query(`
      UPDATE test.escalation_configs
      SET threshold_percent=$1, level_name=$2, notify_roles=$3, action_description=$4
      WHERE id=$5 RETURNING *
    `, [threshold_percent, level_name, notify_roles, action_description, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.escalation_configs WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
