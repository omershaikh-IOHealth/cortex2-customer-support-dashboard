import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// PUT — edit an internal note
// Only the original author or an admin may edit
export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { noteId } = params
  const { content } = await request.json()

  if (!content?.trim())
    return NextResponse.json({ error: 'Content required' }, { status: 400 })

  try {
    const existing = await pool.query(
      'SELECT actor_email FROM main.threads WHERE id = $1 AND action_type = $2',
      [noteId, 'internal_note']
    )
    if (existing.rows.length === 0)
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const isAuthor = existing.rows[0].actor_email === session.user.email
    const isAdmin  = session.user.role === 'admin'
    if (!isAuthor && !isAdmin)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const result = await pool.query(
      `UPDATE main.threads SET raw_content = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [content.trim(), noteId]
    )
    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE — remove an internal note
// Only the original author or an admin may delete
export async function DELETE(request, { params }) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { noteId } = params

  try {
    const existing = await pool.query(
      'SELECT actor_email FROM main.threads WHERE id = $1 AND action_type = $2',
      [noteId, 'internal_note']
    )
    if (existing.rows.length === 0)
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })

    const isAuthor = existing.rows[0].actor_email === session.user.email
    const isAdmin  = session.user.role === 'admin'
    if (!isAuthor && !isAdmin)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await pool.query('DELETE FROM main.threads WHERE id = $1', [noteId])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
