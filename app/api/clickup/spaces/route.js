import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const TOKEN = process.env.CLICKUP_API_TOKEN
const BASE  = 'https://api.clickup.com/api/v2'

async function cuFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: TOKEN },
    next: { revalidate: 120 },
  })
  if (!res.ok) throw new Error(`ClickUp ${path} → ${res.status}`)
  return res.json()
}

// GET /api/clickup/spaces
// Returns: [{ id, name, spaces: [{ id, name, lists: [{ id, name, task_count }] }] }]
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!TOKEN) return NextResponse.json({ error: 'CLICKUP_API_TOKEN not configured' }, { status: 503 })

  try {
    // 1. Get all teams (workspaces)
    const { teams } = await cuFetch('/team')

    // 2. For each team, get spaces in parallel
    const teamsWithSpaces = await Promise.all(
      teams.map(async (team) => {
        const { spaces } = await cuFetch(`/team/${team.id}/space?archived=false`)

        // 3. For each space, get folderless lists + folders->lists in parallel
        const spacesWithLists = await Promise.all(
          spaces.map(async (space) => {
            const [listsRes, foldersRes] = await Promise.all([
              cuFetch(`/space/${space.id}/list?archived=false`),
              cuFetch(`/space/${space.id}/folder?archived=false`),
            ])

            const folderLists = await Promise.all(
              (foldersRes.folders || []).map(async (folder) => {
                const fl = await cuFetch(`/folder/${folder.id}/list?archived=false`)
                return (fl.lists || []).map(l => ({ ...l, _folder: folder.name }))
              })
            )

            const allLists = [
              ...(listsRes.lists || []).map(l => ({ ...l, _folder: null })),
              ...folderLists.flat(),
            ]

            return {
              id: space.id,
              name: space.name,
              lists: allLists.map(l => ({
                id: l.id,
                name: l.name,
                task_count: l.task_count ?? 0,
                folder: l._folder,
                is_configured: l.id === process.env.CLICKUP_LIST_ID,
              })),
            }
          })
        )

        return { id: team.id, name: team.name, spaces: spacesWithLists }
      })
    )

    return NextResponse.json(teamsWithSpaces, {
      headers: { 'Cache-Control': 'private, max-age=120' },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
