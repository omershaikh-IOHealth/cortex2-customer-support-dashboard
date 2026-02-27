import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    await pool.query('SELECT 1')
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ status: 'unhealthy', error: e.message }, { status: 503 })
  }
}
