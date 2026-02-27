import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  try {
    const { company_id, email, name, phone, role, status, is_primary } = await request.json()
    const result = await pool.query(`
      UPDATE test.pocs
      SET company_id=$1, email=$2, name=$3, phone=$4, role=$5, status=$6, is_primary=$7, updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [company_id, email, name, phone, role, status, is_primary, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.pocs WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
