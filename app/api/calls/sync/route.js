import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

const ZIWO_BASE = 'https://iohealth-api.aswat.co'

// POST — sync this agent's own call history from ZIWO (last 30 days)
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Get this user's ZIWO credentials
    const credsResult = await pool.query(
      `SELECT ziwo_email, ziwo_password FROM main.users WHERE id = $1`,
      [session.user.id]
    )
    const creds = credsResult.rows[0]
    if (!creds?.ziwo_email || !creds?.ziwo_password) {
      return NextResponse.json({ error: 'No ZIWO credentials configured for your account' }, { status: 400 })
    }

    // Authenticate with ZIWO
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
    const accessToken =
      loginData.access_token || loginData.token ||
      loginData.data?.access_token || loginData.content?.access_token

    if (!accessToken) {
      return NextResponse.json({ error: 'No access_token in ZIWO login response' }, { status: 502 })
    }

    // Fetch this agent's calls (last 30 days)
    const toDate = new Date().toISOString().slice(0, 10)
    const fromD = new Date(); fromD.setDate(fromD.getDate() - 30)
    const fromDate = fromD.toISOString().slice(0, 10)

    const reportsRes = await fetch(
      `${ZIWO_BASE}/callHistory/?fromDate=${fromDate}&toDate=${toDate}&limit=1000&skip=0`,
      { headers: { access_token: accessToken }, signal: AbortSignal.timeout(60000) }
    )
    if (!reportsRes.ok) {
      const err = await reportsRes.json().catch(() => ({}))
      return NextResponse.json({ error: 'ZIWO reports fetch failed', detail: err }, { status: 502 })
    }
    const reportsData = await reportsRes.json()

    // ZIWO returns { result: true, data: [...] } or array directly
    const calls = Array.isArray(reportsData)
      ? reportsData
      : reportsData.data ?? reportsData.calls ?? reportsData.content ?? []

    if (!Array.isArray(calls)) {
      return NextResponse.json({ error: 'Unexpected ZIWO response shape' }, { status: 502 })
    }

    let synced = 0
    let skipped = 0

    for (const call of calls) {
      const primaryId = call.primary_call_id || call.primaryCallId || call.id
      if (!primaryId) { skipped++; continue }

      const result = await pool.query(
        `INSERT INTO main.call_logs
           (primary_call_id, agent_call_id, agent_id, direction, customer_number,
            queue_name, duration_secs, talk_time_secs, hold_time_secs,
            hangup_cause, hangup_by, recording_file, status,
            started_at, answered_at, ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (primary_call_id) DO NOTHING`,
        [
          primaryId,
          call.agent_call_id || call.agentCallId || null,
          session.user.id,
          call.direction || null,
          call.customer_number || call.customerNumber || call.callerNumber || null,
          call.queue_name || call.queueName || null,
          call.duration_secs || call.duration || null,
          call.talk_time_secs || call.talkTime || null,
          call.hold_time_secs || call.holdTime || null,
          call.hangup_cause || call.hangupCause || null,
          call.hangup_by || call.hangupBy || null,
          call.recording_file || call.recordingFile || null,
          call.status || null,
          call.started_at || call.startedAt || call.start || null,
          call.answered_at || call.answeredAt || null,
          call.ended_at || call.endedAt || call.end || null,
        ]
      )

      if (result.rowCount > 0) synced++
      else skipped++
    }

    return NextResponse.json({ synced, skipped, total: calls.length })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
