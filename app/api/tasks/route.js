import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'
import { decrypt } from '@/lib/crypto'

const LIST_ID = process.env.CLICKUP_LIST_ID || '901215777514'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Get agent's encrypted ClickUp token
    const userResult = await pool.query(
      'SELECT clickup_token_enc FROM main.users WHERE id = $1',
      [session.user.id]
    )
    const enc = userResult.rows[0]?.clickup_token_enc
    if (!enc) return NextResponse.json({ error: 'no_token' }, { status: 404 })

    const token = decrypt(enc)

    // Fetch ClickUp user ID
    const userRes = await fetch('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: token },
    })
    if (!userRes.ok) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    const { user: clickupUser } = await userRes.json()

    // Fetch tasks assigned to this agent from the list
    const tasksRes = await fetch(
      `https://api.clickup.com/api/v2/list/${LIST_ID}/task?assignees[]=${clickupUser.id}&include_closed=false&subtasks=true`,
      { headers: { Authorization: token } }
    )
    if (!tasksRes.ok) {
      const err = await tasksRes.json().catch(() => ({}))
      return NextResponse.json({ error: err.err || 'Failed to fetch tasks' }, { status: tasksRes.status })
    }
    const { tasks } = await tasksRes.json()

    return NextResponse.json({
      tasks: (tasks || []).map(t => ({
        id: t.id,
        name: t.name,
        status: t.status?.status || 'open',
        priority: t.priority?.priority || null,
        due_date: t.due_date ? new Date(Number(t.due_date)).toISOString() : null,
        url: t.url,
        description: t.description,
        date_created: new Date(Number(t.date_created)).toISOString(),
      })),
      clickup_user: { id: clickupUser.id, username: clickupUser.username, email: clickupUser.email },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
