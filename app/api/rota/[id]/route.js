import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// PUT — update shift + replace breaks
export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  const body = await request.json()
  const { shift_date, start_time, end_time, shift_type, notes, breaks } = body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const fields = []
    const vals = []
    let idx = 1
    if (shift_date)  { fields.push(`shift_date = $${idx++}`);  vals.push(shift_date) }
    if (start_time)  { fields.push(`start_time = $${idx++}`);  vals.push(start_time) }
    if (end_time)    { fields.push(`end_time = $${idx++}`);    vals.push(end_time) }
    if (shift_type)  { fields.push(`shift_type = $${idx++}`);  vals.push(shift_type) }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); vals.push(notes) }

    if (fields.length > 0) {
      vals.push(id)
      await client.query(
        `UPDATE test.shift_rotas SET ${fields.join(', ')} WHERE id = $${idx}`,
        vals
      )
    }

    if (breaks !== undefined) {
      await client.query('DELETE FROM test.shift_breaks WHERE shift_id = $1', [id])
      for (const b of breaks) {
        await client.query(
          `INSERT INTO test.shift_breaks (shift_id, break_start, break_end, break_type)
           VALUES ($1, $2, $3, $4)`,
          [id, b.break_start, b.break_end, b.break_type || 'scheduled']
        )
      }
    }

    await client.query('COMMIT')
    return NextResponse.json({ ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}

// DELETE — remove shift (cascades to shift_breaks)
export async function DELETE(request, { params }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  try {
    await pool.query('DELETE FROM test.shift_rotas WHERE id = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
