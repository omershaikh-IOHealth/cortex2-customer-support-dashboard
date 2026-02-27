import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

// GET single circular with version history
export async function GET(request, { params }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  try {
    const [circRes, versRes] = await Promise.all([
      pool.query(
        `SELECT c.*, u.full_name AS created_by_name
         FROM test.circulars c
         LEFT JOIN test.users u ON u.id = c.created_by
         WHERE c.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT cv.*, u.full_name AS changed_by_name
         FROM test.circular_versions cv
         LEFT JOIN test.users u ON u.id = cv.changed_by
         WHERE cv.circular_id = $1
         ORDER BY cv.version DESC`,
        [id]
      ),
    ])

    if (circRes.rows.length === 0)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ ...circRes.rows[0], versions: versRes.rows })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT — update circular (auto-creates version entry)
export async function PUT(request, { params }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  const body = await request.json()
  const { title, content, category, tags, is_active } = body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Snapshot current version before update
    const current = await client.query(
      `SELECT title, content FROM test.circulars WHERE id = $1`,
      [id]
    )
    if (current.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const versionRes = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM test.circular_versions WHERE circular_id = $1`,
      [id]
    )
    const nextVersion = versionRes.rows[0].next_version

    // Save old version
    await client.query(
      `INSERT INTO test.circular_versions (circular_id, version, title, content, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, nextVersion, current.rows[0].title, current.rows[0].content, session.user.id]
    )

    // Apply update
    const fields = []
    const vals = []
    let idx = 1
    if (title !== undefined)     { fields.push(`title = $${idx++}`);     vals.push(title) }
    if (content !== undefined)   { fields.push(`content = $${idx++}`);   vals.push(content) }
    if (category !== undefined)  { fields.push(`category = $${idx++}`);  vals.push(category) }
    if (tags !== undefined)      { fields.push(`tags = $${idx++}`);      vals.push(tags) }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); vals.push(is_active) }
    fields.push(`updated_by = $${idx++}`, `updated_at = NOW()`)
    vals.push(session.user.id)
    vals.push(id)

    const updated = await client.query(
      `UPDATE test.circulars SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    )

    await client.query('COMMIT')
    return NextResponse.json(updated.rows[0])
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}

// DELETE — soft-delete (set is_active = false)
export async function DELETE(request, { params }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  try {
    await pool.query(
      `UPDATE test.circulars SET is_active = false, updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [session.user.id, id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
