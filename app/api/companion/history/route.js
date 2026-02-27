import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { auth } from '@/auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = String(session.user.id)

    const result = await pool.query(
      'SELECT messages, summary FROM test.ai_companion_sessions WHERE user_id = $1',
      [userId]
    )
    if (result.rows.length === 0) return NextResponse.json({ messages: [], summary: null })
    return NextResponse.json({
      messages: result.rows[0].messages || [],
      summary: result.rows[0].summary,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
