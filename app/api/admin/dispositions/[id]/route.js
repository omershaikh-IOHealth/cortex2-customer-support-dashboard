import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import pool from '@/lib/db'

export async function DELETE(request, { params }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  try {
    await pool.query(`DELETE FROM main.call_dispositions WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
