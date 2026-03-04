import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = session.user.role === 'admin'

  try {
    let result
    if (isAdmin) {
      result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ticket_id IS NULL)::int AS fcr_calls,
          COUNT(*)::int AS total_calls,
          ROUND(100.0 * COUNT(*) FILTER (WHERE ticket_id IS NULL) / NULLIF(COUNT(*), 0), 1) AS fcr_rate
        FROM main.call_logs
        WHERE started_at >= NOW() - INTERVAL '30 days'
      `)
    } else {
      result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ticket_id IS NULL)::int AS fcr_calls,
          COUNT(*)::int AS total_calls,
          ROUND(100.0 * COUNT(*) FILTER (WHERE ticket_id IS NULL) / NULLIF(COUNT(*), 0), 1) AS fcr_rate
        FROM main.call_logs
        WHERE started_at >= NOW() - INTERVAL '30 days'
          AND agent_id = $1
      `, [session.user.id])
    }

    const row = result.rows[0]
    return NextResponse.json({
      fcr_rate: row.fcr_rate ? parseFloat(row.fcr_rate) : null,
      fcr_calls: row.fcr_calls,
      total_calls: row.total_calls,
      period: '30d',
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
