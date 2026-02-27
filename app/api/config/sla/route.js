import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT sc.*
      FROM test.sla_configs sc
      JOIN test.solutions s ON sc.solution_id = s.id
      JOIN test.companies c ON s.company_id = c.id
      WHERE c.company_code = 'medgulf' AND s.solution_code = 'app'
      ORDER BY
        CASE sc.priority
          WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 WHEN 'P4' THEN 4 WHEN 'P5' THEN 5
        END
    `)
    return NextResponse.json(result.rows)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
