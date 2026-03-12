/**
 * lib/clickup.js — Multi-tenant ClickUp API client
 *
 * Changes from v1:
 * - createClickUpTask now accepts solution config (list_id + custom field UUIDs from DB)
 * - buildCustomFields reads from solution_custom_fields table (no hardcoded UUIDs)
 * - updateClickUpTask unchanged (still best-effort)
 * - New: getListCustomFields() to hydrate field config per solution
 * - New: setTaskParent() for subtask support
 * - Source/channel field set on task creation
 *
 * Env vars required: CLICKUP_API_TOKEN
 * CLICKUP_LIST_ID is no longer used (list ID comes from solutions table)
 */

const BASE = 'https://api.clickup.com/api/v2'

function headers() {
  return {
    Authorization: process.env.CLICKUP_API_TOKEN,
    'Content-Type': 'application/json',
  }
}

// ─── Status & Priority Maps ───────────────────────────────────────────────────

function mapStatus(cortexStatus) {
  const map = {
    'open':         'open',
    'in progress':  'in progress',
    'pending customer': 'on hold',
    'waiting':      'on hold',
    'on hold':      'on hold',
    'resolved':     'complete',
    'closed':       'complete',
  }
  return map[cortexStatus?.toLowerCase()] ?? cortexStatus?.toLowerCase() ?? 'open'
}

function mapPriority(cortexPriority) {
  // ClickUp: 1=urgent, 2=high, 3=normal, 4=low
  const map = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 4 }
  return map[cortexPriority] || 3
}

// ─── Custom Field Builder ─────────────────────────────────────────────────────

/**
 * Build ClickUp custom_fields array from a ticket and its solution's field config.
 *
 * @param {object} ticket  - fields: request_type, case_type, channel
 * @param {object} fieldConfig - map of field_key → { clickup_field_id, options }
 *   e.g. { request_type: { clickup_field_id: 'xxx', options: { Incident: 'uuid1' } } }
 */
function buildCustomFields(ticket, fieldConfig = {}) {
  const fields = []

  const push = (key, value) => {
    const cfg = fieldConfig[key]
    if (!cfg?.clickup_field_id || !value) return
    const optionUuid = cfg.options?.[value]
    if (!optionUuid) return
    fields.push({ id: cfg.clickup_field_id, value: optionUuid })
  }

  push('request_type', ticket.request_type)
  push('case_type',    ticket.case_type)
  push('source',       ticket.channel)   // channel maps to Source field

  return fields
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * Create a ClickUp task from a Cortex ticket.
 *
 * @param {object} ticket     - Cortex ticket row (must have id, title, etc.)
 * @param {string} listId     - ClickUp list ID (from solutions.clickup_list_id)
 * @param {object} fieldConfig - from solution_custom_fields (key → {clickup_field_id, options})
 * @returns {{ clickup_task_id, clickup_url } | null}
 */
export async function createClickUpTask(ticket, listId, fieldConfig = {}) {
  if (!listId || !process.env.CLICKUP_API_TOKEN) {
    console.warn('[clickup] listId or CLICKUP_API_TOKEN missing — skipping push')
    return null
  }

  try {
    const summaryPart = (ticket.title || '').substring(0, 80)
    const taskName = ticket.id ? `ticketNo-${ticket.id} | ${summaryPart}` : summaryPart

    const customFields = buildCustomFields(ticket, fieldConfig)

    const descParts = [
      ticket.description,
      ticket.module       ? `Module: ${ticket.module}`              : '',
      ticket.request_type ? `Request Type: ${ticket.request_type}`  : '',
      ticket.case_type    ? `Case Type: ${ticket.case_type}`        : '',
      ticket.channel      ? `Source: ${ticket.channel}`             : '',
      ticket.poc_name     ? `Contact: ${ticket.poc_name}`           : '',
    ].filter(Boolean).join('\n\n')

    // Default assignees: Asif (87796566). Pass overrides via ticket.assignee_clickup_ids
    const assignees = ticket.assignee_clickup_ids?.length
      ? ticket.assignee_clickup_ids
      : [87796566]

    const body = {
      name:     taskName,
      description: descParts,
      priority: mapPriority(ticket.priority),
      status:   mapStatus(ticket.status),
      assignees,
      ...(customFields.length > 0 && { custom_fields: customFields }),
    }

    // Subtask: if parent clickup_task_id provided, set parent
    if (ticket.parent_clickup_task_id) {
      body.parent = ticket.parent_clickup_task_id
    }

    const res = await fetch(`${BASE}/list/${listId}/task`, {
      method:  'POST',
      headers: headers(),
      body:    JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[clickup] createTask failed:', res.status, err)
      return null
    }

    const data = await res.json()
    return { clickup_task_id: data.id, clickup_url: data.url }
  } catch (err) {
    console.error('[clickup] createTask error:', err)
    return null
  }
}

/**
 * Update a ClickUp task (best-effort — never throws).
 */
export async function updateClickUpTask(clickupTaskId, changes = {}) {
  if (!clickupTaskId || !process.env.CLICKUP_API_TOKEN) return false

  try {
    const body = {}
    if (changes.title)       body.name        = changes.title
    if (changes.status)      body.status      = mapStatus(changes.status)
    if (changes.priority)    body.priority    = mapPriority(changes.priority)
    if (changes.description) body.description = changes.description
    if (changes.assignees)   body.assignees   = { add: changes.assignees }

    // Custom field updates (supply fieldConfig if changing request_type/case_type/channel)
    if (changes.fieldConfig) {
      const customFields = buildCustomFields(changes, changes.fieldConfig)
      if (customFields.length > 0) body.custom_fields = customFields
    }

    if (Object.keys(body).length === 0) return true

    const res = await fetch(`${BASE}/task/${clickupTaskId}`, {
      method:  'PUT',
      headers: headers(),
      body:    JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[clickup] updateTask failed:', res.status, err)
      return false
    }
    return true
  } catch (err) {
    console.error('[clickup] updateTask error:', err)
    return false
  }
}

/**
 * Add a plain-text comment to a ClickUp task.
 */
export async function addClickUpComment(clickupTaskId, commentText) {
  if (!clickupTaskId || !process.env.CLICKUP_API_TOKEN) return false

  try {
    const res = await fetch(`${BASE}/task/${clickupTaskId}/comment`, {
      method:  'POST',
      headers: headers(),
      body:    JSON.stringify({ comment_text: commentText, notify_all: false }),
    })
    if (!res.ok) {
      console.error('[clickup] addComment failed:', res.status)
      return false
    }
    return true
  } catch (err) {
    console.error('[clickup] addComment error:', err)
    return false
  }
}

/**
 * Set a ClickUp task as a subtask of a parent task.
 * @param {string} taskId     - child task ID
 * @param {string} parentId   - parent task ID (must be in same list or space)
 */
export async function setTaskParent(taskId, parentId) {
  if (!taskId || !parentId || !process.env.CLICKUP_API_TOKEN) return false

  try {
    const res = await fetch(`${BASE}/task/${taskId}`, {
      method:  'PUT',
      headers: headers(),
      body:    JSON.stringify({ parent: parentId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      // 403 likely means cross-space parent — caller should handle this
      console.error('[clickup] setParent failed:', res.status, err)
      return { ok: false, status: res.status, err }
    }
    return { ok: true }
  } catch (err) {
    console.error('[clickup] setParent error:', err)
    return { ok: false, err: err.message }
  }
}

/**
 * Get all workspace members.
 */
export async function getClickUpMembers() {
  if (!process.env.CLICKUP_API_TOKEN) return []

  try {
    const res = await fetch(`${BASE}/team`, { headers: headers() })
    if (!res.ok) return []
    const data = await res.json()
    const members = []
    for (const team of data.teams || []) {
      for (const m of team.members || []) {
        if (m.user) {
          members.push({ id: m.user.id, email: m.user.email, username: m.user.username })
        }
      }
    }
    return members
  } catch {
    return []
  }
}

/**
 * Fetch all tasks from a ClickUp list with full pagination.
 * Returns flat array of task objects.
 *
 * @param {string} listId
 * @param {object} opts - { includeSubtasks, includeClosed }
 */
export async function fetchAllTasksFromList(listId, opts = {}) {
  const { includeSubtasks = true, includeClosed = true } = opts
  const tasks = []
  let page = 0
  let lastPage = false

  while (!lastPage) {
    const url = `${BASE}/list/${listId}/task?include_closed=${includeClosed}&subtasks=${includeSubtasks}&page=${page}`
    const res = await fetch(url, { headers: headers() })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      // Inaccessible list (403/401): return what we have + error flag
      if (res.status === 403 || res.status === 401) {
        console.warn(`[clickup] fetchTasks list ${listId}: unauthorized (${res.status})`)
        return { tasks, unauthorized: true, listId }
      }
      console.error(`[clickup] fetchTasks list ${listId} page ${page} failed:`, res.status, err)
      break
    }

    const data = await res.json()
    tasks.push(...(data.tasks || []))
    lastPage = data.last_page ?? true
    page++
  }

  return { tasks, unauthorized: false, listId }
}

/**
 * Load solution custom field config from DB rows.
 * Converts array of solution_custom_fields rows into a keyed map.
 *
 * Input (DB rows):
 *   [{ field_key: 'request_type', clickup_field_id: 'xxx', options: {...} }, ...]
 *
 * Output:
 *   { request_type: { clickup_field_id: 'xxx', options: { Incident: 'uuid' } }, ... }
 */
export function buildFieldConfig(customFieldRows = []) {
  const config = {}
  for (const row of customFieldRows) {
    config[row.field_key] = {
      clickup_field_id: row.clickup_field_id,
      options: typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || {}),
    }
  }
  return config
}
