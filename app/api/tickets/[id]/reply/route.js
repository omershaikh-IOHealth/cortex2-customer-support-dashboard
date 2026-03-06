import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { sendZohoReply } from '@/lib/zoho'

export async function POST(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  try {
    // Get the zoho_ticket_id for this ticket
    const ticketRes = await pool.query(
      'SELECT zoho_ticket_id, channel FROM main.tickets WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)',
      [id]
    )
    if (!ticketRes.rows.length) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

    const ticket = ticketRes.rows[0]
    if (!ticket.zoho_ticket_id) {
      return NextResponse.json({ error: 'No Zoho ticket ID linked to this ticket' }, { status: 400 })
    }

    // Send reply via Zoho Desk
    const zohoResult = await sendZohoReply(ticket.zoho_ticket_id, content.trim())

    // Log reply as an internal thread entry
    await pool.query(
      `INSERT INTO main.threads (ticket_id, action_type, raw_content, actor_name, thread_source, new_value, created_at)
       VALUES ($1, 'reply_sent', $2, $3, 'zoho_reply', 'Reply sent via Zoho Desk', NOW())`,
      [id, content.trim(), session.user.name || session.user.email]
    )

    return NextResponse.json({ ok: true, zoho: zohoResult })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}

// Save zoho_ticket_id for a ticket (admin only)
export async function PATCH(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const { zoho_ticket_id } = await request.json()
  if (!zoho_ticket_id?.trim()) return NextResponse.json({ error: 'zoho_ticket_id is required' }, { status: 400 })

  try {
    await pool.query(
      'UPDATE main.tickets SET zoho_ticket_id = $1, updated_at = NOW() WHERE id = $2',
      [zoho_ticket_id.trim(), id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
