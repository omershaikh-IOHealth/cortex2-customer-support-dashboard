import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// POST — acknowledge one or more shifts (smart bulk notification)
export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const shiftIds = body.shift_ids || (body.shift_id ? [body.shift_id] : [])
  if (!shiftIds.length) return NextResponse.json({ error: 'shift_ids required' }, { status: 400 })

  try {
    // Update briefing_acks (upsert per shift)
    for (const shiftId of shiftIds) {
      await pool.query(
        `INSERT INTO main.briefing_acks (shift_id, user_id, acked_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (shift_id, user_id) DO NOTHING`,
        [shiftId, session.user.id]
      )
    }

    // Smart bulk notification — single message regardless of shift count
    const count = shiftIds.length
    const label = count === 1 ? '1 shift' : `${count} shifts`
    const admins = await pool.query(
      `SELECT id FROM main.users WHERE role = 'admin' AND is_active = true`
    )
    for (const admin of admins.rows) {
      await pool.query(
        `INSERT INTO main.notifications (user_id, type, title, body, link)
         VALUES ($1, 'system', $2, $3, '/rota')`,
        [
          admin.id,
          `${session.user.name || session.user.email} acknowledged ${label}`,
          `${session.user.name || 'Agent'} confirmed reading their schedule (${label}).`,
        ]
      ).catch(() => {})
    }
    // Also notify the agent themselves
    await pool.query(
      `INSERT INTO main.notifications (user_id, type, title, body)
       VALUES ($1, 'system', $2, $3)`,
      [
        session.user.id,
        `Schedule acknowledged`,
        `You have confirmed your schedule (${label}).`,
      ]
    ).catch(() => {})

    return NextResponse.json({ ok: true, acknowledged: count })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET — fetch acknowledgment status for current user's shifts
export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const shiftIds = searchParams.getAll('shift_id').map(Number).filter(Boolean)

  try {
    if (shiftIds.length === 0) {
      const result = await pool.query(
        `SELECT shift_id, acked_at FROM main.briefing_acks WHERE user_id = $1`,
        [session.user.id]
      )
      const acks = {}
      for (const row of result.rows) acks[row.shift_id] = row.acked_at
      return NextResponse.json(acks)
    }

    const result = await pool.query(
      `SELECT shift_id, acked_at FROM main.briefing_acks
       WHERE user_id = $1 AND shift_id = ANY($2::int[])`,
      [session.user.id, shiftIds]
    )
    const acks = {}
    for (const row of result.rows) acks[row.shift_id] = row.acked_at
    return NextResponse.json(acks)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
