import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// POST /api/rota/bulk — create a weekly schedule for one agent in one request
// Body: { user_id, dates: ['YYYY-MM-DD', ...], start_time, end_time, shift_type, notes, breaks, replace_existing }
export async function POST(request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const {
    user_id,
    dates,
    start_time,
    end_time,
    shift_type = 'regular',
    agent_type = null,
    notes = null,
    breaks = [],
    replace_existing = false,
  } = body

  if (!user_id || !dates?.length || !start_time || !end_time)
    return NextResponse.json({ error: 'user_id, dates, start_time, end_time are required' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let replacedCount = 0

    if (replace_existing) {
      // Delete existing shifts (and their breaks via CASCADE) for this agent on the given dates
      const del = await client.query(
        `DELETE FROM main.shift_rotas WHERE user_id = $1 AND shift_date = ANY($2::date[])`,
        [user_id, dates]
      )
      replacedCount = del.rowCount
    }

    let createdCount = 0
    for (const date of dates) {
      if (!replace_existing) {
        // Skip days that already have a shift for this agent
        const existing = await client.query(
          `SELECT id FROM main.shift_rotas WHERE user_id = $1 AND shift_date = $2 LIMIT 1`,
          [user_id, date]
        )
        if (existing.rows.length > 0) continue
      }

      const shiftRes = await client.query(
        `INSERT INTO main.shift_rotas (user_id, shift_date, start_time, end_time, shift_type, agent_type, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [user_id, date, start_time, end_time, shift_type, agent_type || null, notes, session.user.id]
      )
      const shiftId = shiftRes.rows[0].id

      for (const b of breaks) {
        await client.query(
          `INSERT INTO main.shift_breaks (shift_id, break_start, break_end, break_type)
           VALUES ($1, $2, $3, $4)`,
          [shiftId, b.break_start, b.break_end, b.break_type || 'scheduled']
        )
      }
      createdCount++
    }

    await client.query('COMMIT')
    return NextResponse.json({ created: createdCount, replaced: replacedCount }, { status: 201 })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}
