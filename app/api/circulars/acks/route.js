import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET — fetch acknowledgment status for current user's circulars
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await pool.query(
      `SELECT ca.circular_id, ca.acked_at
       FROM main.circular_acks ca
       WHERE ca.user_id = $1`,
      [session.user.id]
    )
    // Return as a map: { circular_id: acked_at }
    const acks = {}
    for (const row of result.rows) {
      acks[row.circular_id] = row.acked_at
    }
    return NextResponse.json(acks)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — acknowledge a circular (or bulk: { circular_ids: [...] })
export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const ids = body.circular_ids || (body.circular_id ? [body.circular_id] : [])
  if (!ids.length) return NextResponse.json({ error: 'circular_id(s) required' }, { status: 400 })

  try {
    // Upsert acks
    for (const cid of ids) {
      await pool.query(
        `INSERT INTO main.circular_acks (circular_id, user_id, acked_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (circular_id, user_id) DO NOTHING`,
        [cid, session.user.id]
      )
    }

    // Notify admins with a smart message (single notification regardless of count)
    const circularsText = ids.length === 1
      ? `circular #${ids[0]}`
      : `${ids.length} circulars`
    const admins = await pool.query(
      `SELECT id FROM main.users WHERE role = 'admin' AND is_active = true`
    )
    for (const admin of admins.rows) {
      await pool.query(
        `INSERT INTO main.notifications (user_id, type, title, body, link)
         VALUES ($1, 'system', $2, $3, '/knowledge-base')`,
        [
          admin.id,
          `${session.user.name || session.user.email} acknowledged ${circularsText}`,
          `${session.user.name || 'Agent'} has read and acknowledged ${circularsText}.`,
        ]
      ).catch(() => {})
    }

    return NextResponse.json({ ok: true, acknowledged: ids.length })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
