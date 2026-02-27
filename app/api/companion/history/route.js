import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const MOCK_USER_ID = '13'

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT messages, summary FROM test.ai_companion_sessions WHERE user_id = $1',
      [MOCK_USER_ID]
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
