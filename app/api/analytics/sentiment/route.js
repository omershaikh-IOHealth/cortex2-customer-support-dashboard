import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const result = await pool.query(`
      SELECT
        COALESCE(ai_sentiment, 'unknown') AS sentiment,
        COUNT(*) AS count
      FROM main.tickets
      WHERE company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND (is_deleted = false OR is_deleted IS NULL)
        AND created_at >= NOW() - ($1 || ' days')::interval
      GROUP BY ai_sentiment
      ORDER BY count DESC
    `, [days])

    const total = result.rows.reduce((s, r) => s + parseInt(r.count), 0)
    return NextResponse.json(
      result.rows.map(r => ({
        sentiment: r.sentiment,
        count: parseInt(r.count),
        pct: total > 0 ? Math.round((parseInt(r.count) / total) * 100) : 0,
      }))
    )
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
