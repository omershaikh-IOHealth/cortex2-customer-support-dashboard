import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const result = await pool.query(`
      SELECT
        u.id                                                    AS agent_id,
        u.full_name                                             AS agent_name,
        u.email                                                 AS agent_email,
        COUNT(qs.id)                                            AS total_reviews,
        ROUND(AVG(qs.total_score)::numeric, 1)                 AS avg_score,
        COUNT(CASE WHEN qs.result = 'pass'              THEN 1 END) AS pass_count,
        COUNT(CASE WHEN qs.result = 'borderline'        THEN 1 END) AS borderline_count,
        COUNT(CASE WHEN qs.result = 'coaching_required' THEN 1 END) AS coaching_count,
        COUNT(CASE WHEN qs.result = 'fail'              THEN 1 END) AS fail_count,
        COUNT(CASE WHEN qs.result = 'critical_fail'     THEN 1 END) AS critical_fail_count,
        MAX(qs.reviewed_at)                                     AS last_reviewed_at
      FROM main.qa_scores qs
      JOIN main.users u ON u.id = qs.agent_id
      WHERE qs.company_code = 'medgulf'
        AND qs.reviewed_at >= NOW() - ($1 || ' days')::interval
      GROUP BY u.id, u.full_name, u.email
      ORDER BY avg_score DESC NULLS LAST
    `, [days])

    return NextResponse.json(result.rows.map(r => ({
      agent_id:          r.agent_id,
      agent_name:        r.agent_name,
      agent_email:       r.agent_email,
      total_reviews:     parseInt(r.total_reviews),
      avg_score:         r.avg_score !== null ? parseFloat(r.avg_score) : null,
      pass_count:        parseInt(r.pass_count),
      borderline_count:  parseInt(r.borderline_count),
      coaching_count:    parseInt(r.coaching_count),
      fail_count:        parseInt(r.fail_count),
      critical_fail_count: parseInt(r.critical_fail_count),
      last_reviewed_at:  r.last_reviewed_at,
      pass_rate:         r.total_reviews > 0
        ? Math.round((parseInt(r.pass_count) / parseInt(r.total_reviews)) * 100)
        : 0,
    })))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
