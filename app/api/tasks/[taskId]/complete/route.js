import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { decrypt } from '@/lib/crypto'

export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await params

  try {
    const userResult = await pool.query(
      'SELECT clickup_token_enc FROM main.users WHERE id = $1',
      [session.user.id]
    )
    const enc = userResult.rows[0]?.clickup_token_enc
    if (!enc) return NextResponse.json({ error: 'No ClickUp token set' }, { status: 404 })

    const token = decrypt(enc)

    const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      method: 'PUT',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'complete' }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.err || 'ClickUp update failed' }, { status: res.status })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
