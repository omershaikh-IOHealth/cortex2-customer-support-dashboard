import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(request, { params }) {
  try {
    const { id } = params

    // Get the source ticket's attributes
    const src = await pool.query(
      'SELECT module, request_type, case_type FROM test.tickets WHERE id = $1',
      [id]
    )

    if (src.rows.length === 0) {
      return NextResponse.json([])
    }

    const { module, request_type, case_type } = src.rows[0]

    // Try to find similar resolved tickets by all three fields first
    let result = await pool.query(`
      SELECT id, title, clickup_task_id, priority, status, sla_status, sla_consumption_pct,
             module, request_type, case_type, resolved_at, created_at
      FROM test.tickets
      WHERE id != $1
        AND status IN ('Resolved', 'closed', 'complete')
        AND (is_deleted = false OR is_deleted IS NULL)
        AND module = $2
        AND request_type = $3
        AND case_type = $4
      ORDER BY resolved_at DESC NULLS LAST
      LIMIT 5
    `, [id, module, request_type, case_type])

    // Fall back to same module + request_type if not enough results
    if (result.rows.length < 3) {
      result = await pool.query(`
        SELECT id, title, clickup_task_id, priority, status, sla_status, sla_consumption_pct,
               module, request_type, case_type, resolved_at, created_at
        FROM test.tickets
        WHERE id != $1
          AND status IN ('Resolved', 'closed', 'complete')
          AND (is_deleted = false OR is_deleted IS NULL)
          AND module = $2
          AND request_type = $3
        ORDER BY resolved_at DESC NULLS LAST
        LIMIT 5
      `, [id, module, request_type])
    }

    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
