import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const { tag } = await request.json()
  if (!tag?.trim()) return NextResponse.json({ error: 'Tag is required' }, { status: 400 })

  const tagName = tag.trim().toLowerCase()

  try {
    // Update local tags array (avoid duplicates)
    const result = await pool.query(
      `UPDATE main.tickets
       SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), $1),
           updated_at = NOW()
       WHERE id = $2
         AND (is_deleted = false OR is_deleted IS NULL)
         AND NOT (COALESCE(tags, ARRAY[]::text[]) @> ARRAY[$1]::text[])
       RETURNING id, clickup_task_id, tags`,
      [tagName, id]
    )
    if (!result.rows.length) {
      // Tag already exists or ticket not found — check which
      const check = await pool.query('SELECT id FROM main.tickets WHERE id = $1', [id])
      if (!check.rows.length) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      return NextResponse.json({ ok: true, alreadyTagged: true })
    }

    const ticket = result.rows[0]

    // Best-effort: add tag to ClickUp task
    if (ticket.clickup_task_id && process.env.CLICKUP_API_TOKEN) {
      try {
        await fetch(
          `https://api.clickup.com/api/v2/task/${ticket.clickup_task_id}/tag/${encodeURIComponent(tagName)}`,
          {
            method: 'POST',
            headers: { Authorization: process.env.CLICKUP_API_TOKEN },
          }
        )
      } catch {
        // Non-fatal — local tag is already saved
      }
    }

    return NextResponse.json({ ok: true, tags: ticket.tags })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
