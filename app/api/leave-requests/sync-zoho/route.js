import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { fetchLeaveStatus } from '@/lib/zoho-people'

/**
 * GET /api/leave-requests/sync-zoho
 * Polls Zoho People for status updates on all pending leave requests that have a zoho_people_record_id.
 * Called by n8n on a schedule (every 5 min) or manually by admin.
 * Returns a summary of what changed.
 */
export async function GET(request) {
  // Allow internal calls (from n8n) via a key param, or admin session
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const isInternalCall = key && key === process.env.AUTH_SECRET

  if (!isInternalCall) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Fetch all pending leave requests with a Zoho People record ID
    const pending = await pool.query(`
      SELECT lr.id, lr.user_id, lr.zoho_people_record_id, lr.status, lr.zoho_people_status,
             u.email AS user_email, u.full_name AS user_name
      FROM main.leave_requests lr
      JOIN main.users u ON u.id = lr.user_id
      WHERE lr.zoho_people_record_id IS NOT NULL
        AND lr.status = 'pending'
    `)

    if (pending.rows.length === 0) {
      return NextResponse.json({ checked: 0, updated: 0 })
    }

    let updated = 0

    for (const row of pending.rows) {
      try {
        const zohoStatus = await fetchLeaveStatus(row.zoho_people_record_id)
        if (!zohoStatus) continue

        // Only update if status changed
        if (zohoStatus.status !== row.status) {
          await pool.query(
            `UPDATE main.leave_requests
             SET status = $1, zoho_people_status = $2, zoho_people_synced_at = NOW(),
                 updated_at = NOW()
             WHERE id = $3`,
            [zohoStatus.status, zohoStatus.zoho_raw_status, row.id]
          )

          // Notify the agent
          const statusLabel = zohoStatus.status === 'approved' ? 'approved ✓' : 'rejected ✗'
          await pool.query(
            `INSERT INTO main.notifications (user_id, type, title, body, link)
             VALUES ($1, 'leave_update', $2, $3, '/my-requests')`,
            [
              row.user_id,
              `Leave request ${statusLabel}`,
              `Your leave request has been ${zohoStatus.status} in Zoho People${zohoStatus.approver ? ' by ' + zohoStatus.approver : ''}.`,
            ]
          )

          updated++
        } else {
          // Just update the sync timestamp
          await pool.query(
            `UPDATE main.leave_requests SET zoho_people_synced_at = NOW() WHERE id = $1`,
            [row.id]
          )
        }
      } catch (err) {
        console.warn(`[sync-zoho] Failed to check record ${row.zoho_people_record_id}:`, err.message)
      }
    }

    return NextResponse.json({ checked: pending.rows.length, updated })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
