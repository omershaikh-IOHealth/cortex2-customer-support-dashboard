import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request, { params }) {
  try {
    const pocRes = await pool.query(`
      SELECT p.*, c.company_name
      FROM main.pocs p
      LEFT JOIN main.companies c ON p.company_id = c.id
      WHERE p.id = $1
    `, [params.id])
    if (pocRes.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const ticketsRes = await pool.query(`
      SELECT id, title, status, priority, created_at, channel, sla_status
      FROM main.tickets
      WHERE poc_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [params.id])

    return NextResponse.json({ ...pocRes.rows[0], tickets: ticketsRes.rows })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { company_id, email, name, phone, role, status, is_primary, is_vip } = await request.json()
    const result = await pool.query(`
      UPDATE main.pocs
      SET company_id=$1, email=$2, name=$3, phone=$4, role=$5, status=$6, is_primary=$7, is_vip=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [company_id, email, name, phone, role, status, is_primary, is_vip ?? false, params.id])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM main.pocs WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
