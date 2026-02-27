import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import bcrypt from 'bcryptjs'

function checkPasswordComplexity(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter'
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) return 'Password must contain at least one number or symbol'
  return null
}

// GET single user (admin only)
export async function GET(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, ziwo_email, is_active, created_at, updated_at
       FROM test.users WHERE id = $1`,
      [params.id]
    )
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT update user (admin only)
export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { full_name, role, ziwo_email, ziwo_password, is_active, password } = body

    const sets = []
    const vals = []
    let i = 1

    if (full_name !== undefined)  { sets.push(`full_name = $${i++}`); vals.push(full_name) }
    if (role !== undefined)       { sets.push(`role = $${i++}`); vals.push(role) }
    if (ziwo_email !== undefined) { sets.push(`ziwo_email = $${i++}`); vals.push(ziwo_email) }
    if (ziwo_password !== undefined) { sets.push(`ziwo_password = $${i++}`); vals.push(ziwo_password) }
    if (is_active !== undefined)  { sets.push(`is_active = $${i++}`); vals.push(is_active) }
    if (password) {
      const pwErr = checkPasswordComplexity(password)
      if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 })
      const hash = await bcrypt.hash(password, 10)
      sets.push(`password_hash = $${i++}`)
      vals.push(hash)
    }

    if (sets.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    sets.push(`updated_at = NOW()`)
    vals.push(params.id)

    const result = await pool.query(
      `UPDATE test.users SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, email, full_name, role, ziwo_email, is_active, updated_at`,
      vals
    )
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE (deactivate) user (admin only)
export async function DELETE(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Prevent self-deletion
  if (String(params.id) === String(session.user.id)) {
    return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `UPDATE test.users SET is_active = false, updated_at = NOW()
       WHERE id = $1 RETURNING id, email, is_active`,
      [params.id]
    )
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
