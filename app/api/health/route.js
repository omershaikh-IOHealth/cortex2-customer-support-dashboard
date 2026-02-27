import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const checks = {}

  // Database
  try {
    const start = Date.now()
    await pool.query('SELECT 1')
    checks.database = { status: 'operational', latency_ms: Date.now() - start }
  } catch (e) {
    checks.database = { status: 'down', error: e.message }
  }

  // ClickUp API
  if (process.env.CLICKUP_API_TOKEN) {
    try {
      const start = Date.now()
      const res = await fetch('https://api.clickup.com/api/v2/team', {
        headers: { Authorization: process.env.CLICKUP_API_TOKEN },
        signal: AbortSignal.timeout(5000),
      })
      checks.clickup = { status: res.ok ? 'operational' : 'degraded', latency_ms: Date.now() - start }
    } catch (e) {
      checks.clickup = { status: 'down', error: e.message }
    }
  } else {
    checks.clickup = { status: 'not_configured' }
  }

  // Core42 AI
  if (process.env.CORE42_API_KEY) {
    try {
      const start = Date.now()
      const res = await fetch('https://api.core42.ai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.CORE42_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      })
      checks.ai = { status: res.ok ? 'operational' : 'degraded', latency_ms: Date.now() - start }
    } catch (e) {
      checks.ai = { status: 'down', error: e.message }
    }
  } else {
    checks.ai = { status: 'not_configured' }
  }

  // n8n
  checks.n8n = { status: process.env.N8N_WEBHOOK_URL ? 'configured' : 'not_configured' }

  const overall = Object.values(checks).every(
    c => c.status === 'operational' || c.status === 'configured' || c.status === 'not_configured'
  ) ? 'healthy' : 'degraded'

  return NextResponse.json({ status: overall, checks, timestamp: new Date().toISOString() })
}
