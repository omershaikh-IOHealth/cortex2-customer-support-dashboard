import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request, { params }) {
  try {
    const { id } = params
    const { action = 'pause' } = await request.json()

    if (action === 'pause') {
      const result = await pool.query(`
        UPDATE test.tickets
        SET sla_paused_at = NOW(), sla_status = 'paused', updated_at = NOW()
        WHERE id = $1
        RETURNING id, sla_status, sla_paused_at
      `, [id])

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, ...result.rows[0] })
    }

    if (action === 'resume') {
      const result = await pool.query(`
        UPDATE test.tickets
        SET sla_paused_at = NULL,
            sla_status = CASE
              WHEN sla_consumption_pct >= 100 THEN 'breached'
              WHEN sla_consumption_pct >= 90  THEN 'critical'
              WHEN sla_consumption_pct >= 75  THEN 'warning'
              ELSE 'healthy'
            END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, sla_status, sla_paused_at
      `, [id])

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, ...result.rows[0] })
    }

    return NextResponse.json({ error: 'Invalid action. Use "pause" or "resume"' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
