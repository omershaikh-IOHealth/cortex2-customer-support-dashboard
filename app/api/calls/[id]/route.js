import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// PATCH — link a call log to a ticket by primary_call_id
export async function PATCH(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { ticket_id } = await request.json()
    if (!ticket_id) return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 })

    const result = await pool.query(
      `UPDATE main.call_logs SET ticket_id = $1 WHERE primary_call_id = $2 RETURNING id, ticket_id`,
      [ticket_id, decodeURIComponent(params.id)]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Call log not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
