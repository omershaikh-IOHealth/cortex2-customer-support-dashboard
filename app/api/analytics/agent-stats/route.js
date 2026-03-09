import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const result = await pool.query(`
      SELECT
        u.id,
        u.full_name,
        u.email,
        COUNT(t.id)                                                      AS ticket_count,
        COUNT(t.id) FILTER (WHERE t.escalation_level > 0)               AS escalated_count,
        ROUND(AVG(
          CASE WHEN t.resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600.0
          END
        )::numeric, 1)                                                   AS avg_resolution_hours
      FROM main.users u
      JOIN main.tickets t ON t.assigned_to_id = u.id
      WHERE t.company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND (t.is_deleted = false OR t.is_deleted IS NULL)
        AND t.created_at >= NOW() - ($1 || ' days')::interval
        AND u.is_active = true
      GROUP BY u.id, u.full_name, u.email
      ORDER BY ticket_count DESC
      LIMIT 20
    `, [days])

    return NextResponse.json(result.rows.map(r => ({
      id: r.id,
      name: r.full_name,
      email: r.email,
      ticket_count: parseInt(r.ticket_count),
      escalated_count: parseInt(r.escalated_count),
      avg_resolution_hours: r.avg_resolution_hours,
    })))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
