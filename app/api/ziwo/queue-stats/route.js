import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

const ZIWO_BASE = 'https://iohealth-api.aswat.co'

async function getZiwoToken() {
  // Find any agent with ZIWO credentials
  const result = await pool.query(
    'SELECT ziwo_email, ziwo_password FROM main.users WHERE ziwo_email IS NOT NULL AND ziwo_password IS NOT NULL AND is_active = true LIMIT 1'
  )
  const creds = result.rows[0]
  if (!creds) throw new Error('No ZIWO credentials found in database')

  const loginRes = await fetch(`${ZIWO_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: creds.ziwo_email, password: creds.ziwo_password }),
  })
  if (!loginRes.ok) throw new Error('ZIWO login failed')
  const loginData = await loginRes.json()
  const token =
    loginData.access_token ||
    loginData.token ||
    loginData.data?.access_token ||
    loginData.content?.access_token
  if (!token) throw new Error('No access_token in ZIWO login response')
  return token
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const today = new Date().toISOString().slice(0, 10)

  try {
    const token = await getZiwoToken()
    const headers = { 'Content-Type': 'application/json', access_token: token }

    const [agentsRes, summaryRes] = await Promise.all([
      fetch(`${ZIWO_BASE}/statistics/resources/agents/?fromDate=${today}&toDate=${today}`, { headers }),
      fetch(`${ZIWO_BASE}/statistics/summary/?fromDate=${today}&toDate=${today}&breakdown=date`, { headers }),
    ])

    const agentsData  = agentsRes.ok  ? await agentsRes.json()  : {}
    const summaryData = summaryRes.ok ? await summaryRes.json() : {}

    // ZIWO returns array for summary — take first element if so
    const summary = Array.isArray(summaryData) ? summaryData[0] : summaryData

    return NextResponse.json({
      available_agents: agentsData?.Available   ?? agentsData?.available   ?? null,
      on_break:         agentsData?.['On Break'] ?? agentsData?.on_break    ?? null,
      logged_out:       agentsData?.LoggedOut    ?? agentsData?.logged_out  ?? null,
      total_agents:     agentsData?.All          ?? agentsData?.total       ?? null,
      total_inbound:    summary?.totalInboundCalls    ?? summary?.total_inbound    ?? null,
      total_abandoned:  summary?.totalAbandonedCalls  ?? summary?.total_abandoned  ?? null,
      avg_wait_secs:    summary?.averageWaitingTime   ?? summary?.avg_wait_time    ?? null,
      avg_agents_online: summary?.averageAgentsOnline ?? summary?.avg_agents_online ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
