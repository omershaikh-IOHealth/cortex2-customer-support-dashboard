import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

/**
 * POST /api/tickets/[id]/link-as-thread
 * Body: { source_ticket_id: number }
 *
 * Links another ticket's content as a thread entry on this ticket.
 * Use case: agent receives a new email (creates new ticket), realises it
 * belongs to an existing open ticket — merge the email as a thread.
 *
 * The source ticket is NOT deleted; it is simply copied as a thread.
 */
export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const { source_ticket_id } = await request.json()

  if (!source_ticket_id || isNaN(Number(source_ticket_id))) {
    return NextResponse.json({ error: 'source_ticket_id is required' }, { status: 400 })
  }

  try {
    // Verify target ticket exists
    const targetRes = await pool.query(
      `SELECT id FROM main.tickets WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)`,
      [id]
    )
    if (!targetRes.rows.length) return NextResponse.json({ error: 'Target ticket not found' }, { status: 404 })

    // Fetch source ticket details
    const sourceRes = await pool.query(
      `SELECT id, title, description, channel, zoho_ticket_id, created_by_email, created_by_name, created_at
       FROM main.tickets
       WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)`,
      [Number(source_ticket_id)]
    )
    if (!sourceRes.rows.length) return NextResponse.json({ error: 'Source ticket not found' }, { status: 404 })

    if (String(id) === String(source_ticket_id)) {
      return NextResponse.json({ error: 'Cannot link a ticket to itself' }, { status: 400 })
    }

    const src = sourceRes.rows[0]

    // Build thread content
    const rawContent = [
      `Subject: ${src.title}`,
      src.description ? `\n${src.description}` : '',
    ].filter(Boolean).join('\n').substring(0, 5000)

    // Insert as a thread on the target ticket
    const threadRes = await pool.query(
      `INSERT INTO main.threads (
        ticket_id, action_type, actor_email, actor_name,
        raw_content, thread_source, metadata, created_at
      ) VALUES ($1, 'linked_email', $2, $3, $4, 'linked_email', $5::jsonb, $6)
      RETURNING id`,
      [
        id,
        src.created_by_email || session.user.email,
        src.created_by_name || src.created_by_email || 'Unknown',
        rawContent,
        JSON.stringify({
          source_ticket_id: src.id,
          source_channel: src.channel,
          source_zoho_id: src.zoho_ticket_id,
          source_title: src.title,
          linked_by: session.user.email,
        }),
        src.created_at || new Date().toISOString(),
      ]
    )

    return NextResponse.json({
      ok: true,
      thread_id: threadRes.rows[0].id,
      source_ticket: { id: src.id, title: src.title, channel: src.channel },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
