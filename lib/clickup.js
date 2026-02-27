/**
 * ClickUp API client
 * Env vars required: CLICKUP_API_TOKEN, CLICKUP_LIST_ID
 *
 * Custom fields on list 901215777514 (from n8n workflow):
 *   83ff465c-0075-495c-aeb8-7db8cc56110a  → Request Type  (dropdown)
 *   de899780-bc87-4ec2-ba94-fe01690ab330  → Case Type     (dropdown)
 *
 * Default assignee: 87796566 (Asif K)
 */

const BASE = 'https://api.clickup.com/api/v2'

// ClickUp dropdown option UUIDs for Request Type (verified from n8n workflow)
const REQUEST_TYPE_MAP = {
  'Incident':         '037ea1a4-88f0-43d0-9bd9-386fc385aaac',
  'Service Request':  '2adace70-cf37-48aa-9b74-c05f5df185b6',
  'Problem':          '44f3a550-7b10-4e57-b59b-efbb63b6fb9c',
  'Change Request':   '904d1493-1ef1-4bfe-a731-40c825c28963',
}

// ClickUp dropdown option UUIDs for Case Type (verified from n8n workflow)
const CASE_TYPE_MAP = {
  'Availability':     '71924ef3-bd27-46f4-af4b-986f21db3b9d',
  'Core Function':    '75b4337c-75d0-46b8-a849-618e19f1fbdd',
  'Integration':      '7d6f15a1-2bef-4989-a5c4-9d79adbc28b1',
  'Data Integrity':   'd960b7a3-005c-4b72-a64d-a438fd6980ee',
  'Performance':      '7c02067a-2703-4dd2-80c7-53a412b52302',
  'Stability':        '2a69eb54-c762-44da-bb36-41a568dcd10a',
  'Security':         '9412cc67-a469-436f-a875-617ddedf28c8',
  'UI / UX':          'f6116b75-c6ca-452c-9737-a4859b211495',
  'Support':          '4ea73a69-a682-41ec-96e3-3ffb32fb45cd',
  'Access':           '1cd65a2e-89fa-4771-be97-1f9fe6002a1d',
  'Problem Record':   '11115504-b918-4ad9-addb-49b02973978a',
  'Enhancement':      '6c05810f-baba-4bc8-aed5-efa9fb2ce86e',
}

function headers() {
  return {
    Authorization: process.env.CLICKUP_API_TOKEN,
    'Content-Type': 'application/json',
  }
}

/**
 * Map Cortex priority (P1–P5) to ClickUp priority (1–4)
 * ClickUp: 1=urgent, 2=high, 3=normal, 4=low
 */
function mapPriority(cortexPriority) {
  const map = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 4 }
  return map[cortexPriority] || 3
}

/**
 * Build the custom_fields array for ClickUp task creation.
 * Only includes fields where we have a known UUID mapping.
 */
function buildCustomFields(ticket) {
  const fields = []

  if (ticket.request_type && REQUEST_TYPE_MAP[ticket.request_type]) {
    fields.push({
      id: '83ff465c-0075-495c-aeb8-7db8cc56110a',
      value: REQUEST_TYPE_MAP[ticket.request_type],
    })
  }

  if (ticket.case_type && CASE_TYPE_MAP[ticket.case_type]) {
    fields.push({
      id: 'de899780-bc87-4ec2-ba94-fe01690ab330',
      value: CASE_TYPE_MAP[ticket.case_type],
    })
  }

  return fields
}

/**
 * Create a ClickUp task from a Cortex ticket.
 * Returns { clickup_task_id, clickup_url } or null on failure.
 *
 * Task name format: "ticketNo-{id} | {summary}" (max 80 chars for summary)
 */
export async function createClickUpTask(ticket) {
  const listId = process.env.CLICKUP_LIST_ID
  if (!listId || !process.env.CLICKUP_API_TOKEN) {
    console.warn('[clickup] CLICKUP_API_TOKEN or CLICKUP_LIST_ID not configured — skipping push')
    return null
  }

  try {
    const summaryPart = (ticket.title || '').substring(0, 80)
    const taskName = ticket.id
      ? `ticketNo-${ticket.id} | ${summaryPart}`
      : summaryPart

    const customFields = buildCustomFields(ticket)

    const body = {
      name: taskName,
      description: [
        ticket.description,
        ticket.module      ? `Module: ${ticket.module}`           : '',
        ticket.request_type ? `Request Type: ${ticket.request_type}` : '',
        ticket.case_type   ? `Case Type: ${ticket.case_type}`     : '',
        ticket.poc_name    ? `Contact: ${ticket.poc_name}`        : '',
      ].filter(Boolean).join('\n\n'),
      priority: mapPriority(ticket.priority),
      status: ticket.status || 'Open',
      assignees: [87796566],
      ...(customFields.length > 0 && { custom_fields: customFields }),
    }

    const res = await fetch(`${BASE}/list/${listId}/task`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[clickup] createTask failed:', res.status, err)
      return null
    }

    const data = await res.json()
    return {
      clickup_task_id: data.id,
      clickup_url: data.url,
    }
  } catch (err) {
    console.error('[clickup] createTask error:', err)
    return null
  }
}

/**
 * Update a ClickUp task.
 * Returns true on success, false on failure.
 */
export async function updateClickUpTask(clickupTaskId, changes = {}) {
  if (!clickupTaskId || !process.env.CLICKUP_API_TOKEN) return false

  try {
    const body = {}
    if (changes.title)       body.name = changes.title
    if (changes.status)      body.status = changes.status
    if (changes.priority)    body.priority = mapPriority(changes.priority)
    if (changes.description) body.description = changes.description

    // Update custom fields if request_type or case_type changed
    const customFields = buildCustomFields(changes)
    if (customFields.length > 0) body.custom_fields = customFields

    if (Object.keys(body).length === 0) return true

    const res = await fetch(`${BASE}/task/${clickupTaskId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
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
