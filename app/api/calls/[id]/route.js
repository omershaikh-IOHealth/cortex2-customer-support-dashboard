import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// PATCH — link a call log to a ticket by primary_call_id
export async function PATCH(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { ticket_id, disposition_id, customer_name } = body

    const sets = []
    const vals = []
    let i = 1

    if (ticket_id !== undefined) { sets.push(`ticket_id = $${i++}`); vals.push(ticket_id) }
    if (disposition_id !== undefined) { sets.push(`disposition_id = $${i++}`); vals.push(disposition_id) }
    if (customer_name !== undefined) { sets.push(`customer_name = $${i++}`); vals.push(customer_name) }

    if (!sets.length) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    vals.push(decodeURIComponent(await params.id))
    const result = await pool.query(
      `UPDATE main.call_logs SET ${sets.join(', ')} WHERE primary_call_id = $${i} RETURNING id, ticket_id, disposition_id`,
      vals
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Call log not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
