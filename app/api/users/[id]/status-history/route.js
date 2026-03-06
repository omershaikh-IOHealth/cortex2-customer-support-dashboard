import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET /api/users/[id]/status-history?date=YYYY-MM-DD
// Admin: returns status history for any agent. Agent: only own.
export async function GET(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  // Agents can only view their own history
  if (session.user.role !== 'admin' && String(session.user.id) !== String(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
      [id, date]
    ).catch(() => ({ rows: [] }))

    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json([])
  }
}
