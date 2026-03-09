import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await pool.query(
      `SELECT id, name, company_code, created_at
       FROM main.call_dispositions
       WHERE company_code = 'medgulf'
       ORDER BY id ASC`
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  try {
    const result = await pool.query(
      `INSERT INTO main.call_dispositions (name, company_code, created_by)
       VALUES ($1, 'medgulf', $2) RETURNING *`,
      [name.trim(), session.user.id]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
