import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { message: 'N8N_WEBHOOK_URL is not configured. Add it to .env.local to enable Force Sync.' },
        { status: 501 }
      )
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual_sync', timestamp: new Date().toISOString() }),
    })

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`)
    }

    return NextResponse.json({ ok: true, message: 'Sync triggered successfully' })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
