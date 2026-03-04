import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

const ZIWO_BASE = 'https://iohealth-api.aswat.co'

function dateStr(d) {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

async function ziwoLogin(email, password) {
  const res = await fetch(`${ZIWO_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
  })
  if (!res.ok) throw new Error(`ZIWO login failed: ${res.status}`)
  const data = await res.json()
  const token = data.access_token || data.token || data.data?.access_token || data.content?.access_token
  if (!token) throw new Error('No access_token in ZIWO login response')
  return token
}

async function fetchCallHistory(accessToken, fromDate, toDate) {
  const url = `${ZIWO_BASE}/callHistory/?fromDate=${fromDate}&toDate=${toDate}&limit=1000&skip=0`
  const res = await fetch(url, {
    headers: { access_token: accessToken },
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error('ZIWO callHistory fetch failed'), { detail: err, status: res.status })
  }
  const data = await res.json()
  // ZIWO returns { result: true, data: [...] } or array directly
  return Array.isArray(data) ? data : data.data ?? data.calls ?? data.content ?? []
}

function mapCall(call, agentId) {
  return [
    call.primaryCallId || call.primary_call_id || call.id,
    call.agentCallId || call.agent_call_id || null,
    agentId,
    call.direction || null,
    call.callerNumber || call.customerNumber || call.customer_number || null,
    call.queueName || call.queue_name || null,
    call.duration ?? call.duration_secs ?? null,
    call.talkTime ?? call.talk_time_secs ?? null,
    call.holdTime ?? call.hold_time_secs ?? null,
    call.hangupCause || call.hangup_cause || null,
    call.hangupBy || call.hangup_by || null,
    call.recordingFile || call.recording_file || null,
    call.result || call.status || null,
    call.startTime || call.started_at || call.queueEnterDateTime || null,
    call.answeredDateTime || call.answered_at || null,
    call.endTime || call.ended_at || null,
  ]
}

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Step 1: Get first admin with ZIWO credentials
    const credsResult = await pool.query(
      `SELECT id, ziwo_email, ziwo_password FROM main.users
       WHERE role = 'admin' AND ziwo_email IS NOT NULL AND ziwo_password IS NOT NULL
       LIMIT 1`
    )
    const creds = credsResult.rows[0]
    if (!creds) return NextResponse.json({ error: 'No admin with ZIWO credentials found' }, { status: 400 })

    // Step 2: Authenticate
    const accessToken = await ziwoLogin(creds.ziwo_email, creds.ziwo_password)

    // Step 3: Fetch last 30 days
    const toDate = dateStr(new Date())
    const fromD = new Date(); fromD.setDate(fromD.getDate() - 30)
    const fromDate = dateStr(fromD)

    const calls = await fetchCallHistory(accessToken, fromDate, toDate)
    if (!Array.isArray(calls)) {
      return NextResponse.json({ error: 'Unexpected ZIWO response', raw: calls }, { status: 502 })
    }

    // Step 4: Upsert each call; resolve agent_id by ziwo_email
    let synced = 0, skipped = 0

    for (const call of calls) {
      const primaryId = call.primaryCallId || call.primary_call_id || call.id
      if (!primaryId) { skipped++; continue }

      // Resolve agent
      let agentId = null
      const agentEmail = call.agentEmail || call.agent_email
      if (agentEmail) {
        const r = await pool.query(`SELECT id FROM main.users WHERE ziwo_email = $1 LIMIT 1`, [agentEmail])
        agentId = r.rows[0]?.id ?? null
      }

      const result = await pool.query(
        `INSERT INTO main.call_logs
           (primary_call_id, agent_call_id, agent_id, direction, customer_number,
            queue_name, duration_secs, talk_time_secs, hold_time_secs,
            hangup_cause, hangup_by, recording_file, status,
            started_at, answered_at, ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (primary_call_id) DO NOTHING`,
        mapCall(call, agentId)
      )
      if (result.rowCount > 0) synced++; else skipped++
    }

    return NextResponse.json({ synced, skipped, total: calls.length })
  } catch (e) {
    return NextResponse.json({ error: e.message, detail: e.detail }, { status: 502 })
  }
}
