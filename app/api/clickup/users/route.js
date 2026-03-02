import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getClickUpMembers } from '@/lib/clickup'

// GET — returns flat list of ClickUp workspace members { id, email, username }
// Cached for 5 minutes via React Query staleTime on the client side.
export async function GET() {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await getClickUpMembers()
  return NextResponse.json(members, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
