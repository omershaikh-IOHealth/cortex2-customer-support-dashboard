import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

// GET — check if token is set (never return the raw token)
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await pool.query(
      'SELECT clickup_token_enc FROM main.users WHERE id = $1',
      [session.user.id]
    )
    const isSet = !!result.rows[0]?.clickup_token_enc
    return NextResponse.json({ isSet })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT — save encrypted token; verify it against ClickUp first
export async function PUT(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await request.json()
  if (!token?.trim()) return NextResponse.json({ error: 'Token is required' }, { status: 400 })

  // Verify token is valid by calling ClickUp /user
  let clickupUser
  try {
    const res = await fetch('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: token.trim() },
    })
    if (!res.ok) return NextResponse.json({ error: 'Invalid ClickUp token — could not authenticate with ClickUp' }, { status: 400 })
    const data = await res.json()
    clickupUser = data.user
  } catch {
    return NextResponse.json({ error: 'Failed to reach ClickUp API' }, { status: 502 })
  }

  try {
    const encrypted = encrypt(token.trim())
    await pool.query(
      'UPDATE main.users SET clickup_token_enc = $1, updated_at = NOW() WHERE id = $2',
      [encrypted, session.user.id]
    )
    return NextResponse.json({
      ok: true,
      clickup_username: clickupUser?.username,
      clickup_email: clickupUser?.email,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — remove token
export async function DELETE() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await pool.query(
      'UPDATE main.users SET clickup_token_enc = NULL, updated_at = NOW() WHERE id = $1',
      [session.user.id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
