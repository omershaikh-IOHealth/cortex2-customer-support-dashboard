import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const { decision, supervisor_note } = await request.json() // 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const swapResult = await client.query(
      'SELECT * FROM main.shift_swaps WHERE id = $1 AND status = $2',
      [id, 'awaiting_supervisor']
    )
    if (!swapResult.rows.length) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Swap not found or not awaiting supervisor review' }, { status: 404 })
    }
    const swap = swapResult.rows[0]

    // If approved: physically swap shift data between the two shift_rotas rows
    if (decision === 'approved') {
      const r1 = await client.query('SELECT * FROM main.shift_rotas WHERE id = $1', [swap.requester_shift_id])
      const r2 = swap.target_shift_id
        ? await client.query('SELECT * FROM main.shift_rotas WHERE id = $1', [swap.target_shift_id])
        : { rows: [] }

      if (r1.rows.length && r2.rows.length) {
        const s1 = r1.rows[0]
        const s2 = r2.rows[0]
        // Swap start_time, end_time, shift_type, notes (keep user_id and shift_date in place)
        await client.query(
          `UPDATE main.shift_rotas
           SET start_time = $1, end_time = $2, shift_type = $3, notes = $4, updated_at = NOW()
           WHERE id = $5`,
          [s2.start_time, s2.end_time, s2.shift_type, s2.notes, s1.id]
        )
        await client.query(
          `UPDATE main.shift_rotas
           SET start_time = $1, end_time = $2, shift_type = $3, notes = $4, updated_at = NOW()
           WHERE id = $5`,
          [s1.start_time, s1.end_time, s1.shift_type, s1.notes, s2.id]
        )
      }
    }

    // Update swap record
    await client.query(
      `UPDATE main.shift_swaps
       SET supervisor_response = $1, supervisor_id = $2, supervisor_note = $3,
           status = $4, updated_at = NOW()
       WHERE id = $5`,
      [decision, session.user.id, supervisor_note?.trim() || null, decision, id]
    )

    await client.query('COMMIT')

    // Notify both agents
    const msg = decision === 'approved'
      ? 'Your shift swap has been approved and shifts have been updated.'
      : `Your shift swap was rejected. ${supervisor_note || ''}`
    await pool.query(
      `INSERT INTO main.notifications (user_id, type, title, body, link)
       VALUES ($1, 'shift_swap', $2, $3, '/briefing'),
              ($4, 'shift_swap', $2, $3, '/briefing')`,
      [swap.requester_id, `Shift swap ${decision}`, msg, swap.target_agent_id]
    ).catch(() => {})

    return NextResponse.json({ ok: true, decision })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}
