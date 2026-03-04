import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    if (session.user.role !== 'admin') {
      const result = await pool.query(
        `SELECT ROUND(AVG(COALESCE(talk_time_secs, duration_secs)) / 60.0, 1) AS avg_minutes
         FROM main.call_logs
         WHERE agent_id = $1
           AND started_at >= NOW() - INTERVAL '30 days'
           AND COALESCE(talk_time_secs, duration_secs) > 0`,
        [session.user.id]
      )
      return NextResponse.json({
        avg_minutes: result.rows[0].avg_minutes ? parseFloat(result.rows[0].avg_minutes) : null,
        period: '30d',
      })
    }

    const result = await pool.query(
      `SELECT ROUND(AVG(COALESCE(talk_time_secs, duration_secs)) / 60.0, 1) AS avg_minutes
       FROM main.call_logs
       WHERE started_at >= NOW() - INTERVAL '30 days'
         AND COALESCE(talk_time_secs, duration_secs) > 0`
    )
    return NextResponse.json({
      avg_minutes: result.rows[0].avg_minutes ? parseFloat(result.rows[0].avg_minutes) : null,
      period: '30d',
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
