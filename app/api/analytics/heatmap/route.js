import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const result = await pool.query(`
      SELECT
        EXTRACT(DOW FROM created_at AT TIME ZONE 'Asia/Dubai')::int  AS dow,
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Dubai')::int AS hour,
        COUNT(*) AS count
      FROM main.tickets
      WHERE company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND (is_deleted = false OR is_deleted IS NULL)
        AND created_at >= NOW() - ($1 || ' days')::interval
      GROUP BY dow, hour
      ORDER BY dow, hour
    `, [days])

    // Build a 7×24 matrix (dow 0=Sun … 6=Sat, hour 0–23)
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0))
    let max = 0
    for (const row of result.rows) {
      const v = parseInt(row.count)
      matrix[row.dow][row.hour] = v
      if (v > max) max = v
    }

    return NextResponse.json({ matrix, max })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
