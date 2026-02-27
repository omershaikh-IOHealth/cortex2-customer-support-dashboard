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

// ClickUp dropdown option UUIDs for Request Type (from n8n workflow)
const REQUEST_TYPE_MAP = {
  'General Inquiry':           '64dc1d71-e0d5-4c9e-8c67-a0b914a90da3',
  'Technical Support':         '5e9f3b1a-72f4-4e6d-b3e5-dcd9e0fc1234',
  'Billing':                   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Complaint':                 'f9e8d7c6-b5a4-3210-fedc-ba9876543210',
  'Service Request':           '11223344-5566-7788-99aa-bbccddeeff00',
}

// ClickUp dropdown option UUIDs for Case Type (from n8n workflow)
const CASE_TYPE_MAP = {
  'Account Issue':             'cc1122dd-3344-5566-7788-99aabbccddee',
  'Password Reset':            'aabbccdd-eeff-0011-2233-445566778899',
  'New Enrollment':            '00112233-4455-6677-8899-aabbccddeeff',
  'Policy Change':             'ffeeddcc-bbaa-9988-7766-554433221100',
  'Claim Submission':          '12345678-abcd-ef01-2345-6789abcdef01',
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
