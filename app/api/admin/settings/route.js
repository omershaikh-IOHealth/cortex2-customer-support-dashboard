import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET — fetch all system settings
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await pool.query(`SELECT key, value FROM main.system_settings`)
    const settings = {}
    for (const row of result.rows) settings[row.key] = row.value
    return NextResponse.json(settings)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT — update one or more settings (admin only)
export async function PUT(request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  try {
    for (const [key, value] of Object.entries(body)) {
      await pool.query(
        `INSERT INTO main.system_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [key, String(value), session.user.id]
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
