import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET today's shift for the current agent
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await pool.query(
      `SELECT id, shift_date, start_time, end_time, shift_type, notes
       FROM test.shift_rotas
       WHERE user_id = $1 AND shift_date = CURRENT_DATE
       LIMIT 1`,
      [session.user.id]
    )
    return NextResponse.json(result.rows[0] || null)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
