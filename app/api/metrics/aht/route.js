import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const agentFilter = session.user.role === 'admin' ? '' : 'AND agent_id = $1'
    const params = session.user.role === 'admin' ? [] : [session.user.id]

    const [dailyRes, monthlyRes] = await Promise.all([
      pool.query(
        `SELECT ROUND(AVG(COALESCE(talk_time_secs, duration_secs))) AS daily_seconds
         FROM main.call_logs
         WHERE DATE(started_at AT TIME ZONE 'UTC') = CURRENT_DATE
           AND COALESCE(talk_time_secs, duration_secs) > 0
           ${agentFilter}`,
        params
      ),
      pool.query(
        `SELECT ROUND(AVG(COALESCE(talk_time_secs, duration_secs))) AS monthly_seconds
         FROM main.call_logs
         WHERE started_at >= NOW() - INTERVAL '30 days'
           AND COALESCE(talk_time_secs, duration_secs) > 0
           ${agentFilter}`,
        params
      ),
    ])

    return NextResponse.json({
      daily_seconds: dailyRes.rows[0].daily_seconds ? parseInt(dailyRes.rows[0].daily_seconds) : null,
      monthly_seconds: monthlyRes.rows[0].monthly_seconds ? parseInt(monthlyRes.rows[0].monthly_seconds) : null,
      // Legacy field for backwards compatibility
      avg_minutes: monthlyRes.rows[0].monthly_seconds
        ? parseFloat((monthlyRes.rows[0].monthly_seconds / 60).toFixed(1))
        : null,
      period: '30d',
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
