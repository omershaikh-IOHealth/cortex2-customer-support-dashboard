import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const MOCK_USER_ID = '13'

export async function POST() {
  try {
    await pool.query(
      `UPDATE test.ai_companion_sessions
       SET messages = '[]'::jsonb, summary = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [MOCK_USER_ID]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
