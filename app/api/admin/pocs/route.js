import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const search = searchParams.get('search')

    const params = []
    const conditions = []

    if (company_id) {
      params.push(company_id)
      conditions.push(`p.company_id = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(`(p.name ILIKE $${n} OR p.email ILIKE $${n} OR p.phone ILIKE $${n} OR c.company_name ILIKE $${n})`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await pool.query(`
      SELECT p.*, c.company_name,
        (SELECT COUNT(*)::int FROM main.tickets t
         WHERE t.poc_id = p.id AND t.status NOT IN ('Resolved', 'Closed')) AS open_ticket_count
      FROM main.pocs p
      LEFT JOIN main.companies c ON p.company_id = c.id
      ${where}
      ORDER BY p.name
    `, params)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { company_id, email, name, phone, role, status, is_primary, is_vip } = await request.json()
    const result = await pool.query(`
      INSERT INTO main.pocs (company_id, email, name, phone, role, status, is_primary, is_vip, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [company_id, email, name, phone, role, status || 'active', is_primary || false, is_vip || false])
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
