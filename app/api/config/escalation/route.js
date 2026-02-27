import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT ec.*
      FROM test.escalation_configs ec
      JOIN test.solutions s ON ec.solution_id = s.id
      JOIN test.companies c ON s.company_id = c.id
      WHERE c.company_code = 'medgulf' AND s.solution_code = 'app'
      ORDER BY ec.level
    `)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
