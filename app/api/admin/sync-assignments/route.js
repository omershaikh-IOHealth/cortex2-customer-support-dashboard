import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const BASE = 'https://api.clickup.com/api/v2'

/**
 * POST /api/admin/sync-assignments
 *
 * One-time (or on-demand) backfill: reads all ClickUp tasks in the configured
 * list, extracts the first assignee per task, then updates test.tickets with
 * assigned_to_email (and assigned_to_id if the email matches a test.users row).
 *
 * Returns a summary of how many tickets were updated / skipped.
 */
export async function POST() {
  const listId = process.env.CLICKUP_LIST_ID
  const token  = process.env.CLICKUP_API_TOKEN

  if (!listId || !token) {
    return NextResponse.json(
      { error: 'CLICKUP_LIST_ID or CLICKUP_API_TOKEN is not configured' },
      { status: 501 }
    )
  }

  try {
    // 1. Fetch all tasks from ClickUp (handles pagination)
    const tasks = []
    let page = 0
    let lastPage = false

    while (!lastPage) {
      const res = await fetch(
        `${BASE}/list/${listId}/task?include_closed=true&subtasks=false&page=${page}`,
        { headers: { Authorization: token } }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json(
          { error: `ClickUp API error: ${res.status}`, detail: err },
          { status: 502 }
        )
      }
      const data = await res.json()
      tasks.push(...(data.tasks || []))
      lastPage = data.last_page ?? true
      page++
    }

    // 2. Build a map: clickup_task_id → first assignee email
    const assigneeMap = {}
    for (const task of tasks) {
      if (task.assignees?.length > 0) {
        assigneeMap[task.id] = task.assignees[0].email
      }
    }

    // 3. Load all test.users emails → id so we can resolve assigned_to_id
    const usersResult = await pool.query('SELECT id, email FROM test.users')
    const userEmailToId = {}
    for (const u of usersResult.rows) {
      userEmailToId[u.email.toLowerCase()] = u.id
    }

    // 4. Load tickets that have a clickup_task_id but no assignment yet
    const ticketsResult = await pool.query(`
      SELECT id, clickup_task_id
      FROM test.tickets
      WHERE clickup_task_id IS NOT NULL
        AND (assigned_to_email IS NULL OR assigned_to_email = '')
        AND (is_deleted = false OR is_deleted IS NULL)
    `)

    let updated = 0
    let skipped = 0

    for (const ticket of ticketsResult.rows) {
      const email = assigneeMap[ticket.clickup_task_id]
      if (!email) { skipped++; continue }

      const userId = userEmailToId[email.toLowerCase()] ?? null

      await pool.query(
        `UPDATE test.tickets
         SET assigned_to_email = $1, assigned_to_id = $2, updated_at = NOW()
         WHERE id = $3`,
        [email, userId, ticket.id]
      )
      updated++
    }

    return NextResponse.json({
      ok: true,
      total_clickup_tasks: tasks.length,
      tickets_checked: ticketsResult.rows.length,
      updated,
      skipped_no_assignee: skipped,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
