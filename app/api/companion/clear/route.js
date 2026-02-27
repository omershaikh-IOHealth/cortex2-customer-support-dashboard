import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { auth } from '@/auth'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = String(session.user.id)

    await pool.query(
      `UPDATE test.ai_companion_sessions
       SET messages = '[]'::jsonb, summary = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
