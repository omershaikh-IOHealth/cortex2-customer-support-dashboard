import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { addClickUpComment } from '@/lib/clickup'

// POST — post a comment to the linked ClickUp task
// Body: { content }
export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = params
    const { content } = await request.json()

    if (!content?.trim())
      return NextResponse.json({ error: 'Comment content required' }, { status: 400 })

    const ticketRow = await pool.query(
      'SELECT clickup_task_id FROM main.tickets WHERE id = $1',
      [id]
    )
    const clickupTaskId = ticketRow.rows[0]?.clickup_task_id

    if (!clickupTaskId)
      return NextResponse.json({ error: 'Ticket has no linked ClickUp task' }, { status: 400 })

    const actorName = session.user.name || session.user.email
    const ok = await addClickUpComment(clickupTaskId, `[${actorName}]: ${content.trim()}`)

    if (!ok)
      return NextResponse.json({ error: 'Failed to post comment to ClickUp' }, { status: 502 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
