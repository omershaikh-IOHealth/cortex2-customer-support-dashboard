import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

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
      INSERT INTO main.threads
        (ticket_id, action_type, actor_email, actor_name, raw_content, thread_source, created_at)
      VALUES ($1, 'internal_note', $2, $3, $4, 'internal', NOW())
      RETURNING *
    `, [id, actorEmail, actorName, content.trim()])

    // Internal notes are NOT synced to ClickUp — they stay on the dashboard only.

    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
