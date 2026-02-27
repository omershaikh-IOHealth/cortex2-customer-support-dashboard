import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

const ZIWO_BASE = 'https://iohealth-api.aswat.co'

/**
 * ZIWO agent status numbers (confirmed from live network traces):
 *   1 = Available
 *   2 = On Break   ← confirmed: sending 2 shows "On Break" in ZIWO
 *   3 = Meeting    ← confirmed: sending 3 shows "Meeting" in ZIWO
 *   4 = Outgoing   ← confirmed: sending 4 shows "Outgoing" in ZIWO (set by call, not manually)
 *   5 = Not Ready  ← assumed; verify by checking ZIWO after setting "Not Ready"
 *
 * If a number maps incorrectly, adjust STATUS_NUMBER below.
 */
const STATUS_NUMBER = {
  available: 1,
  break:     2,
  meeting:   3,
  not_ready: 5,
}

export async function POST(request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await request.json()
  const number = STATUS_NUMBER[status]
  if (number === undefined) {
    return NextResponse.json({ error: `Unknown status: ${status}` }, { status: 400 })
  }

  try {
    // Get this agent's ZIWO credentials from DB
    const credsResult = await pool.query(
      'SELECT ziwo_email, ziwo_password FROM test.users WHERE id = $1',
      [session.user.id]
    )
    const creds = credsResult.rows[0]
    if (!creds?.ziwo_email || !creds?.ziwo_password) {
      return NextResponse.json({ error: 'No ZIWO credentials configured for this user' }, { status: 400 })
    }

    // 1. Authenticate with ZIWO to get access_token
    const loginRes = await fetch(`${ZIWO_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: creds.ziwo_email, password: creds.ziwo_password }),
    })
    if (!loginRes.ok) {
      const err = await loginRes.json().catch(() => ({}))
      return NextResponse.json({ error: 'ZIWO login failed', detail: err }, { status: 502 })
    }
    const loginData = await loginRes.json()
    // ZIWO returns token at various paths depending on version — try them all
    const accessToken =
      loginData.access_token ||
      loginData.token ||
      loginData.data?.access_token ||
      loginData.content?.access_token

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access_token in ZIWO login response', raw: loginData },
        { status: 502 }
      )
    }

    // 2. Push status to ZIWO
    const statusRes = await fetch(`${ZIWO_BASE}/agents/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'access_token': accessToken,
      },
      body: JSON.stringify({ number, comment: '' }),
    })
    const statusData = await statusRes.json()

    return NextResponse.json({ ok: statusRes.ok, result: statusData })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
