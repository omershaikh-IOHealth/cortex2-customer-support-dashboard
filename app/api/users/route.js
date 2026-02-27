import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET all users (admin only)
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.ziwo_email, u.is_active, u.created_at,
              s.status as agent_status, s.status_note, s.set_at as status_set_at
       FROM test.users u
       LEFT JOIN test.agent_status s ON s.user_id = u.id
       ORDER BY u.role, u.full_name`
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

function checkPasswordComplexity(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter'
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) return 'Password must contain at least one number or symbol'
  return null
}

// POST create user (admin only)
export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { email, password, full_name, role, ziwo_email, ziwo_password } = body

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'email, password, full_name, role are required' }, { status: 400 })
    }
    if (!['admin', 'agent'].includes(role)) {
      return NextResponse.json({ error: 'role must be admin or agent' }, { status: 400 })
    }
    const pwErr = checkPasswordComplexity(password)
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 })

    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO test.users (email, password_hash, full_name, role, ziwo_email, ziwo_password)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, ziwo_email, is_active, created_at`,
      [email, hash, full_name, role, ziwo_email || null, ziwo_password || null]
    )
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (e) {
    if (e.code === '23505') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
