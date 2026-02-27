import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request, { params }) {
  try {
    const result = await pool.query('SELECT * FROM test.companies WHERE id = $1', [params.id])
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { company_code, company_name, description, domain, is_active } = await request.json()
    const result = await pool.query(`
      UPDATE test.companies
      SET company_code = $1, company_name = $2, description = $3, domain = $4, is_active = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [company_code, company_name, description, domain, is_active, params.id])
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await pool.query('DELETE FROM test.companies WHERE id = $1', [params.id])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
