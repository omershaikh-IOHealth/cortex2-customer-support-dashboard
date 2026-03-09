/**
 * Temporary debug endpoint — remove after fixing auth.
 * Usage: GET /api/debug-login?key=AUTH_SECRET&email=...&password=...
 */
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!key || key !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = searchParams.get('email')
  const password = searchParams.get('password')
  const steps = []

  try {
    // Step 1: Check env
    steps.push({ step: 'env', AUTH_SECRET_set: !!process.env.AUTH_SECRET, AUTH_SECRET_length: process.env.AUTH_SECRET?.length })

    // Step 2: Import pool
    const { default: pool } = await import('@/lib/db')
    steps.push({ step: 'pool_imported', ok: true })

    // Step 3: Query user
    const result = await pool.query(
      `SELECT id, email, role, is_active, login_attempts, locked_until,
              LEFT(password_hash, 10) as hash_preview,
              LENGTH(password_hash) as hash_length
       FROM main.users WHERE email = $1 LIMIT 1`,
      [email]
    )
    if (result.rows.length === 0) {
      steps.push({ step: 'user_lookup', found: false })
      return NextResponse.json({ steps })
    }
    const user = result.rows[0]
    steps.push({ step: 'user_lookup', found: true, role: user.role, is_active: user.is_active, locked_until: user.locked_until, hash_preview: user.hash_preview, hash_length: user.hash_length })

    // Step 4: Bcrypt compare
    if (password) {
      const { default: bcrypt } = await import('bcryptjs')
      steps.push({ step: 'bcrypt_imported', ok: true })
      const valid = await bcrypt.compare(password, await pool.query(`SELECT password_hash FROM main.users WHERE email = $1 LIMIT 1`, [email]).then(r => r.rows[0].password_hash))
      steps.push({ step: 'bcrypt_compare', valid })
    }

    return NextResponse.json({ steps })
  } catch (err) {
    steps.push({ step: 'ERROR', message: err.message, stack: err.stack?.split('\n').slice(0, 5) })
    return NextResponse.json({ steps }, { status: 500 })
  }
}
