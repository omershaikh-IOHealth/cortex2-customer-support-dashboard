import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { submitLeaveRequest } from '@/lib/zoho-people'

export async function GET(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true' && session.user.role === 'admin'

  try {
    const result = await pool.query(`
      SELECT lr.*,
        u.full_name AS user_name, u.email AS user_email,
        r.full_name AS reviewer_name
      FROM main.leave_requests lr
      JOIN main.users u ON u.id = lr.user_id
      LEFT JOIN main.users r ON r.id = lr.reviewed_by
      WHERE ${all ? 'TRUE' : 'lr.user_id = $1'}
      ORDER BY lr.created_at DESC
    `, all ? [] : [session.user.id])
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { start_date, end_date, leave_type, note, start_time, end_time } = await request.json()
  if (!start_date || !end_date || !leave_type) {
    return NextResponse.json({ error: 'start_date, end_date, and leave_type are required' }, { status: 400 })
  }

  try {
    // 1. Resolve the Zoho People leave type ID from our leave_types table
    const ltRow = await pool.query(
      'SELECT zoho_type_id FROM main.leave_types WHERE zoho_type_id = $1 OR name ILIKE $2 LIMIT 1',
      [leave_type, leave_type]
    )
    const zohoLeaveTypeId = ltRow.rows[0]?.zoho_type_id || leave_type

    // 2. Insert into DB
    const result = await pool.query(
      `INSERT INTO main.leave_requests (user_id, start_date, end_date, leave_type, note, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [session.user.id, start_date, end_date, leave_type, note?.trim() || null, start_time || null, end_time || null]
    )
    const leaveRequest = result.rows[0]

    // 3. Push to Zoho People (non-blocking — don't fail if Zoho is unavailable)
    try {
      const zohoRecordId = await submitLeaveRequest({
        employeeEmail: session.user.email,
        leaveTypeId: zohoLeaveTypeId,
        fromDate: start_date,
        toDate: end_date,
        reason: note?.trim() || '',
        isHalfDay: !!(start_time && end_time),
      })
      await pool.query(
        `UPDATE main.leave_requests
         SET zoho_people_record_id = $1, zoho_people_status = 'pending', zoho_people_synced_at = NOW()
         WHERE id = $2`,
        [zohoRecordId, leaveRequest.id]
      )
      leaveRequest.zoho_people_record_id = zohoRecordId
    } catch (zpErr) {
      // Zoho People unavailable — leave stays in DB with null zoho_people_record_id
      console.warn('[leave-requests] Zoho People push failed (non-fatal):', zpErr.message)
    }

    // 4. Notify all admins
    const admins = await pool.query(
      "SELECT id FROM main.users WHERE role = 'admin' AND is_active = true"
    )
    if (admins.rows.length) {
      const agentName = session.user.name || session.user.email
      const body = `${leave_type} leave: ${start_date} – ${end_date}${note?.trim() ? ' · ' + note.trim() : ''}`
      const placeholders = admins.rows.map((_, i) => `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5})`).join(',')
      const values = admins.rows.flatMap(a => [a.id, 'leave_request', `Leave request from ${agentName}`, body, '/rota'])
      await pool.query(
        `INSERT INTO main.notifications (user_id, type, title, body, link) VALUES ${placeholders}`,
        values
      )
    }

    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
