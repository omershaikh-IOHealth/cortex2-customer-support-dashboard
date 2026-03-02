import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { addClickUpComment } from '@/lib/clickup'

export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = params
    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Note content required' }, { status: 400 })
    }

    const actorEmail = session.user.email
    const actorName = session.user.name || actorEmail

    const result = await pool.query(`
      INSERT INTO test.threads
        (ticket_id, action_type, actor_email, actor_name, raw_content, thread_source, created_at)
      VALUES ($1, 'internal_note', $2, $3, $4, 'internal', NOW())
      RETURNING *
    `, [id, actorEmail, actorName, content.trim()])

    // Sync to ClickUp (best-effort, non-blocking)
    const ticketRow = await pool.query(
      'SELECT clickup_task_id FROM test.tickets WHERE id = $1',
      [id]
    )
    const clickupTaskId = ticketRow.rows[0]?.clickup_task_id
    if (clickupTaskId) {
      addClickUpComment(clickupTaskId, `[${actorName}]: ${content.trim()}`).catch(() => {})
    }

    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
