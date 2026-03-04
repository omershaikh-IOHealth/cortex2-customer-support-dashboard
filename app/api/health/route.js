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

  // ZIWO
  if (process.env.ZIWO_CC_NAME) {
    try {
      const start = Date.now()
      const res = await fetch('https://iohealth-api.aswat.co', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      })
      const agentCount = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM main.users WHERE ziwo_email IS NOT NULL`
      )
      checks.ziwo = {
        status: res.ok || res.status < 500 ? 'operational' : 'degraded',
        latency_ms: Date.now() - start,
        agents_configured: agentCount.rows[0].cnt,
      }
    } catch (e) {
      checks.ziwo = { status: 'down', error: e.message }
    }
  } else {
    checks.ziwo = { status: 'not_configured' }
  }

  // n8n — check webhook config + last processing log
  const n8nConfigured = !!process.env.N8N_WEBHOOK_URL
  try {
    const lastRun = await pool.query(
      `SELECT status, created_at FROM main.processing_logs ORDER BY created_at DESC LIMIT 1`
    )
    const row = lastRun.rows[0]
    checks.n8n = {
      status: n8nConfigured ? 'configured' : 'not_configured',
      last_run: row?.created_at || null,
      last_status: row?.status || null,
    }
  } catch {
    checks.n8n = { status: n8nConfigured ? 'configured' : 'not_configured', last_run: null, last_status: null }
  }

  // Zoho Desk — no env var, always not_configured
  checks.zoho = { status: 'not_configured' }

  const overall = Object.values(checks).every(
    c => c.status === 'operational' || c.status === 'configured' || c.status === 'not_configured'
  ) ? 'healthy' : 'degraded'

  return NextResponse.json({ status: overall, checks, timestamp: new Date().toISOString() })
}
