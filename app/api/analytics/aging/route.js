import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        CASE
          WHEN age_hours < 4    THEN '0–4h'
          WHEN age_hours < 8    THEN '4–8h'
          WHEN age_hours < 24   THEN '8–24h'
          WHEN age_hours < 72   THEN '1–3d'
          WHEN age_hours < 168  THEN '3–7d'
          ELSE '7d+'
        END AS bucket,
        COUNT(*) AS count,
        CASE
          WHEN age_hours < 4    THEN 1
          WHEN age_hours < 8    THEN 2
          WHEN age_hours < 24   THEN 3
          WHEN age_hours < 72   THEN 4
          WHEN age_hours < 168  THEN 5
          ELSE 6
        END AS sort_order
      FROM (
        SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0 AS age_hours
        FROM main.tickets
        WHERE company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
          AND (is_deleted = false OR is_deleted IS NULL)
          AND status NOT IN ('complete', 'Closed')
      ) t
      GROUP BY bucket, sort_order
      ORDER BY sort_order
    `)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
