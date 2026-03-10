import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { fetchLeaveTypes } from '@/lib/zoho-people'

/**
 * GET /api/leave-types
 * Returns leave types from DB (seeded from Zoho People).
 * If the table is empty, fetches from Zoho People, seeds DB, then returns.
 */
export async function GET() {
  try {
    // Try DB first
    const result = await pool.query(
      'SELECT id, zoho_type_id, name, description FROM main.leave_types WHERE is_active = true ORDER BY name'
    )

    if (result.rows.length > 0) {
      return NextResponse.json(result.rows)
    }

    // DB is empty — seed from Zoho People
    const types = await fetchLeaveTypes()
    if (types.length === 0) {
      // Zoho People not reachable yet — return defaults so the form still works
      return NextResponse.json([
        { id: null, zoho_type_id: 'annual',  name: 'Annual Leave',  description: null },
        { id: null, zoho_type_id: 'sick',    name: 'Sick Leave',    description: null },
        { id: null, zoho_type_id: 'other',   name: 'Other',         description: null },
      ])
    }

    // Insert into DB
    for (const t of types) {
      await pool.query(
        `INSERT INTO main.leave_types (zoho_type_id, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (zoho_type_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [t.zoho_type_id, t.name, t.description]
      )
    }

    const seeded = await pool.query(
      'SELECT id, zoho_type_id, name, description FROM main.leave_types WHERE is_active = true ORDER BY name'
    )
    return NextResponse.json(seeded.rows)
  } catch (e) {
    // Graceful fallback — never block the leave form
    console.error('[leave-types] Error:', e.message)
    return NextResponse.json([
      { id: null, zoho_type_id: 'annual',  name: 'Annual Leave',  description: null },
      { id: null, zoho_type_id: 'sick',    name: 'Sick Leave',    description: null },
      { id: null, zoho_type_id: 'other',   name: 'Other',         description: null },
    ])
  }
}

/**
 * POST /api/leave-types/refresh
 * Admin-only: forces a re-sync of leave types from Zoho People.
 */
export async function POST() {
  try {
    const types = await fetchLeaveTypes()
    for (const t of types) {
      await pool.query(
        `INSERT INTO main.leave_types (zoho_type_id, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (zoho_type_id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true`,
        [t.zoho_type_id, t.name, t.description]
      )
    }
    return NextResponse.json({ synced: types.length })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
