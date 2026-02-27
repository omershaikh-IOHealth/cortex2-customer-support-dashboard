import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const MOCK_USER = {
  id: '13',
  email: 'omer.shaikh@iohealth.com',
  name: 'Omer Shaikh',
}

export async function POST(request, { params }) {
  try {
    const { id } = params
    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Note content required' }, { status: 400 })
    }

    const result = await pool.query(`
      INSERT INTO test.threads
        (ticket_id, action_type, actor_email, actor_name, raw_content, thread_source, created_at)
      VALUES ($1, 'internal_note', $2, $3, $4, 'internal', NOW())
      RETURNING *
    `, [id, MOCK_USER.email, MOCK_USER.name, content.trim()])

    return NextResponse.json(result.rows[0])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
