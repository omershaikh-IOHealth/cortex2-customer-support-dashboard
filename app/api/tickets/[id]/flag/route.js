import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const { reason } = await request.json()
  if (!reason?.trim()) return NextResponse.json({ error: 'Reason is required' }, { status: 400 })

  try {
    const result = await pool.query(
      `UPDATE main.tickets
       SET flag_for_qa = true,
           qa_flag_reason = $1,
           qa_flagged_by = $2,
           qa_flagged_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 AND (is_deleted = false OR is_deleted IS NULL)
       RETURNING id, flag_for_qa, qa_flag_reason, qa_flagged_at`,
      [reason.trim(), session.user.id, id]
    )
    if (!result.rows.length) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params

  try {
    const result = await pool.query(
      `UPDATE main.tickets
       SET flag_for_qa = false,
           qa_flag_reason = NULL,
           qa_flagged_by = NULL,
           qa_flagged_at = NULL,
           updated_at = NOW()
       WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)
       RETURNING id`,
      [id]
    )
    if (!result.rows.length) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
