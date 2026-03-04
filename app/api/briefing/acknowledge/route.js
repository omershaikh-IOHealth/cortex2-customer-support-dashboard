import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET ?shift_id=N — returns ack status for the current user
export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const shift_id = parseInt(searchParams.get('shift_id'))
  if (!shift_id) return NextResponse.json({ error: 'shift_id required' }, { status: 400 })

  try {
    const result = await pool.query(
      `SELECT acked_at FROM main.briefing_acks
       WHERE user_id = $1 AND shift_id = $2`,
      [session.user.id, shift_id]
    )
    if (result.rows.length > 0) {
      return NextResponse.json({ acked: true, acked_at: result.rows[0].acked_at })
    }
    return NextResponse.json({ acked: false, acked_at: null })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST { shift_id } — acknowledge a shift (no-op if already acked)
export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const shift_id = parseInt(body.shift_id)
  if (!shift_id) return NextResponse.json({ error: 'shift_id required' }, { status: 400 })

  try {
    // Guard: check if already acknowledged
    const existing = await pool.query(
      `SELECT id, acked_at FROM main.briefing_acks WHERE user_id = $1 AND shift_id = $2`,
      [session.user.id, shift_id]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ acked: true, acked_at: existing.rows[0].acked_at })
    }

    const result = await pool.query(
      `INSERT INTO main.briefing_acks (user_id, shift_id) VALUES ($1, $2) RETURNING acked_at`,
      [session.user.id, shift_id]
    )
    return NextResponse.json({ acked: true, acked_at: result.rows[0].acked_at })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
