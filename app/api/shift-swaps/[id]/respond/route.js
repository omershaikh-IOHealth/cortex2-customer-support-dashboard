import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { response } = await request.json() // 'accepted' | 'declined'
  if (!['accepted', 'declined'].includes(response)) {
    return NextResponse.json({ error: 'response must be accepted or declined' }, { status: 400 })
  }

  try {
    // Verify this agent is the target
    const check = await pool.query(
      'SELECT * FROM main.shift_swaps WHERE id = $1 AND target_agent_id = $2 AND target_response = $3',
      [id, session.user.id, 'pending']
    )
    if (!check.rows.length) {
      return NextResponse.json({ error: 'Swap request not found or already responded' }, { status: 404 })
    }

    const newStatus = response === 'accepted' ? 'awaiting_supervisor' : 'rejected'

    const result = await pool.query(
      `UPDATE main.shift_swaps
       SET target_response = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [response, newStatus, id]
    )
    const swap = result.rows[0]

    // Notify requester
    await pool.query(
      `INSERT INTO main.notifications (user_id, type, title, body, link)
       VALUES ($1, 'shift_swap', $2, $3, '/briefing')`,
      [
        swap.requester_id,
        `Shift swap ${response}`,
        response === 'accepted'
          ? `${session.user.name || session.user.email} accepted your swap request. Awaiting supervisor approval.`
          : `${session.user.name || session.user.email} declined your swap request.`,
      ]
    ).catch(() => {})

    // If accepted, notify all admins that a swap awaits supervisor approval
    if (response === 'accepted') {
      const admins = await pool.query(
        "SELECT id FROM main.users WHERE role = 'admin' AND is_active = true"
      )
      if (admins.rows.length) {
        // Fetch requester name for the message
        const requesterRes = await pool.query('SELECT full_name FROM main.users WHERE id = $1', [swap.requester_id])
        const requesterName = requesterRes.rows[0]?.full_name || 'An agent'
        const targetName = session.user.name || session.user.email
        const placeholders = admins.rows.map((_, i) => `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5})`).join(',')
        const values = admins.rows.flatMap(a => [
          a.id, 'shift_swap', 'Shift swap awaiting approval',
          `${requesterName} ↔ ${targetName} — both agents agreed`, '/rota'
        ])
        await pool.query(
          `INSERT INTO main.notifications (user_id, type, title, body, link) VALUES ${placeholders}`,
          values
        ).catch(() => {})
      }
    }

    return NextResponse.json(swap)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
