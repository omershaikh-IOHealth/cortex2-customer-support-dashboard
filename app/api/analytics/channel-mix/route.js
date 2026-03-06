import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(NULLIF(TRIM(channel), ''), 'email') AS channel,
        COUNT(*)::int AS count
      FROM main.tickets
      WHERE company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND (is_deleted = false OR is_deleted IS NULL)
      GROUP BY COALESCE(NULLIF(TRIM(channel), ''), 'email')
      ORDER BY count DESC
    `)

    const total = result.rows.reduce((sum, r) => sum + r.count, 0)
    const rows = result.rows.map(r => ({
      channel: r.channel,
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
    }))

    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
