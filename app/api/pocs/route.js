import { NextResponse } from 'next/server'
import pool from '@/lib/db'

// GET /api/pocs?phone=:number — look up a POC by phone number (used for caller screen pop)
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')

  if (!phone) return NextResponse.json(null)

  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.email, p.is_vip, c.company_name,
              (SELECT COUNT(*)::int FROM main.tickets t
               WHERE t.poc_id = p.id
                 AND t.status NOT IN ('Resolved','Closed')) AS open_ticket_count
       FROM main.pocs p
       LEFT JOIN main.companies c ON p.company_id = c.id
       WHERE p.phone = $1
       LIMIT 1`,
      [phone]
    )

    return NextResponse.json(result.rows[0] ?? null)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
