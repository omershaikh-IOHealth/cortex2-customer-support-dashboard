import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET ?date=YYYY-MM-DD — returns ack status for all shifts on that date (admin only)
export async function GET(request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  try {
    const result = await pool.query(
      `SELECT ba.shift_id, ba.user_id, ba.acked_at, u.full_name AS agent_name
       FROM main.briefing_acks ba
       JOIN main.shift_rotas sr ON sr.id = ba.shift_id
       JOIN main.users u ON u.id = ba.user_id
       WHERE TO_CHAR(sr.shift_date, 'YYYY-MM-DD') = $1`,
      [date]
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
