import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET /api/users/me/status-history?date=YYYY-MM-DD
// Returns today's agent status history with durations
export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  try {
    const result = await pool.query(
      `SELECT status, started_at, ended_at,
              EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))::int AS duration_secs
       FROM main.agent_status_history
       WHERE user_id = $1
         AND DATE(started_at AT TIME ZONE 'UTC') = $2
       ORDER BY started_at ASC`,
      [session.user.id, date]
    ).catch(() => ({ rows: [] })) // graceful if table doesn't exist

    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json([]) // always succeed
  }
}
