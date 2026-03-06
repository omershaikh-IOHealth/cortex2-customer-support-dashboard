import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await pool.query(`
      SELECT DISTINCT unnest(tags) AS tag
      FROM main.tickets
      WHERE company_id = (SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1)
        AND (is_deleted = false OR is_deleted IS NULL)
        AND tags IS NOT NULL
        AND array_length(tags, 1) > 0
      ORDER BY tag
    `)
    return NextResponse.json(result.rows.map(r => r.tag))
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
