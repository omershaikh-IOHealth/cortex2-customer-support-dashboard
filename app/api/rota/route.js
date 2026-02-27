import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET all shifts for a date range (admin) or own shifts (agent)
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&user_id=N
export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') || new Date().toISOString().slice(0, 10)
  const to   = searchParams.get('to')   || new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10)

  // Agents can only see their own shifts
  const userId = session.user.role === 'admin'
    ? (searchParams.get('user_id') || null)
    : session.user.id

  try {
    const params = [from, to]
    const userFilter = userId ? ' AND sr.user_id = $3' : ''
    if (userId) params.push(userId)

    const result = await pool.query(
      `SELECT sr.id, sr.user_id, sr.shift_date, sr.start_time, sr.end_time,
              sr.shift_type, sr.notes,
              u.full_name AS agent_name, u.email AS agent_email,
              COALESCE(
                json_agg(
                  json_build_object('id', sb.id, 'break_start', sb.break_start,
                                    'break_end', sb.break_end, 'break_type', sb.break_type)
                  ORDER BY sb.break_start
                ) FILTER (WHERE sb.id IS NOT NULL),
                '[]'
              ) AS breaks
       FROM test.shift_rotas sr
       JOIN test.users u ON u.id = sr.user_id
       LEFT JOIN test.shift_breaks sb ON sb.shift_id = sr.id
       WHERE sr.shift_date BETWEEN $1 AND $2${userFilter}
       GROUP BY sr.id, u.full_name, u.email
       ORDER BY sr.shift_date, sr.start_time`,
      params
    )
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — admin creates a shift (with optional breaks)
// Body: { user_id, shift_date, start_time, end_time, shift_type, notes, breaks: [{break_start, break_end, break_type}] }
export async function POST(request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { user_id, shift_date, start_time, end_time, shift_type = 'regular', notes = null, breaks = [] } = body

  if (!user_id || !shift_date || !start_time || !end_time)
    return NextResponse.json({ error: 'user_id, shift_date, start_time, end_time are required' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const shiftRes = await client.query(
      `INSERT INTO test.shift_rotas (user_id, shift_date, start_time, end_time, shift_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_id, shift_date, start_time, end_time, shift_type, notes, session.user.id]
    )
    const shift = shiftRes.rows[0]

    for (const b of breaks) {
      await client.query(
        `INSERT INTO test.shift_breaks (shift_id, break_start, break_end, break_type)
         VALUES ($1, $2, $3, $4)`,
        [shift.id, b.break_start, b.break_end, b.break_type || 'scheduled']
      )
    }

    await client.query('COMMIT')
    return NextResponse.json(shift, { status: 201 })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}
