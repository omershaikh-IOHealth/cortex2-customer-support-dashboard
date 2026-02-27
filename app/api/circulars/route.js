import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET circulars — ?all=true (admin only) returns all including archived
export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const showAll = new URL(request.url).searchParams.get('all') === 'true' && session.user.role === 'admin'

  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.content, c.category, c.tags, c.is_active,
              c.created_at, c.updated_at,
              u.full_name as created_by_name
       FROM test.circulars c
       LEFT JOIN test.users u ON c.created_by = u.id
       ${showAll ? '' : 'WHERE c.is_active = true'}
       ORDER BY c.is_active DESC, c.updated_at DESC`
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST create circular (admin only)
export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { title, content, category, tags } = await request.json()
    if (!title || !content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
    }

    const result = await pool.query(
      `INSERT INTO test.circulars (title, content, category, tags, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, title, category, tags, is_active, created_at`,
      [title, content, category || null, tags || null, session.user.id]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
