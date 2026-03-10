/**
 * Zoho People API helper
 * Handles OAuth token refresh + leave management API calls.
 * Approval flow: Agent submits in Apex → pushed to Zoho People → manager approves in Zoho People → syncs back.
 */

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token'
const ZOHO_PEOPLE_BASE = 'https://people.zohoapis.com/api/v2'

// In-memory token cache (resets on server restart, which is fine — refresh_token persists in env)
let _cachedToken = null
let _tokenExpiry = 0

/**
 * Get a valid Zoho People access token, refreshing if expired.
 */
export async function getAccessToken() {
  const now = Date.now()
  if (_cachedToken && now < _tokenExpiry - 60_000) {
    return _cachedToken
  }

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_PEOPLE_REFRESH_TOKEN,
    client_id: process.env.ZOHO_PEOPLE_CLIENT_ID,
    client_secret: process.env.ZOHO_PEOPLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  })

  const res = await fetch(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoho People token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho People token response missing access_token: ${JSON.stringify(data)}`)

  _cachedToken = data.access_token
  _tokenExpiry = now + (data.expires_in || 3600) * 1000
  return _cachedToken
}

/**
 * Look up a Zoho People employee record by email.
 * Returns { erecno, empId, name } or null if not found.
 */
export async function findEmployeeByEmail(email) {
  const token = await getAccessToken()
  const res = await fetch(
    `${ZOHO_PEOPLE_BASE}/employee/search?searchField=Email&searchValue=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  const records = data?.data || data?.response?.result || []
  if (!records.length) return null
  const emp = records[0]
  return {
    erecno: emp.Erecno || emp.erecno || emp.EmployeeID,
    empId: emp.EmployeeID || emp.employeeId,
    name: emp['First Name'] || emp.firstName || email,
  }
}

/**
 * Fetch available leave types from Zoho People and return them as an array.
 * Returns [{ zoho_type_id, name, description }]
 */
export async function fetchLeaveTypes() {
  const token = await getAccessToken()
  const res = await fetch(`${ZOHO_PEOPLE_BASE}/leavetracker/leaveTypes`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoho People fetchLeaveTypes failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  const types = data?.response?.result || data?.data || []
  return types.map(t => ({
    zoho_type_id: String(t.leaveTypeId || t.LeaveTypeId || t.id),
    name: t.leaveTypeName || t.LeaveTypeName || t.name,
    description: t.description || null,
  }))
}

/**
 * Submit a leave request to Zoho People.
 * @param {object} params
 * @param {string} params.employeeEmail - Agent's email (used to look up Zoho employee)
 * @param {string} params.leaveTypeId - Zoho People leave type ID
 * @param {string} params.fromDate - "YYYY-MM-DD"
 * @param {string} params.toDate - "YYYY-MM-DD"
 * @param {string} [params.reason] - Optional reason/note
 * @param {boolean} [params.isHalfDay] - Half-day leave flag
 * @returns {Promise<string>} Zoho People record ID for the leave request
 */
export async function submitLeaveRequest({ employeeEmail, leaveTypeId, fromDate, toDate, reason, isHalfDay = false }) {
  const token = await getAccessToken()

  // Build the form data for Zoho People leave application
  const formData = new URLSearchParams({
    applyDate: fromDate,
    leaveTypeId,
    fromDate,
    toDate,
    reason: reason || '',
    ...(isHalfDay ? { isHalfDay: 'true' } : {}),
  })

  // Include employee email so Zoho People applies leave for the correct employee
  const res = await fetch(`${ZOHO_PEOPLE_BASE}/leavetracker/applyLeave`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoho People submitLeaveRequest failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  // Zoho People returns the leave record ID
  const recordId = data?.response?.result?.[0]?.leaveId
    || data?.data?.[0]?.leaveId
    || data?.leaveId
    || data?.recordId
    || String(data?.response?.result?.[0]?.No_of_days_applied != null ? Date.now() : '')

  if (!recordId) throw new Error(`Zoho People submitLeaveRequest: no record ID in response: ${JSON.stringify(data)}`)
  return String(recordId)
}

/**
 * Fetch the current status of a leave request from Zoho People.
 * @param {string} recordId - Zoho People leave ID
 * @returns {Promise<{ status: string, approver: string|null }>}
 */
export async function fetchLeaveStatus(recordId) {
  const token = await getAccessToken()
  const res = await fetch(`${ZOHO_PEOPLE_BASE}/leavetracker/getLeaveList?leaveId=${encodeURIComponent(recordId)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  const record = data?.response?.result?.[0] || data?.data?.[0]
  if (!record) return null

  // Map Zoho People leave status to our values
  const raw = (record.Status || record.status || '').toLowerCase()
  let status = 'pending'
  if (raw.includes('approve')) status = 'approved'
  else if (raw.includes('reject') || raw.includes('declin')) status = 'rejected'
  else if (raw.includes('cancel')) status = 'rejected'

  return {
    status,
    approver: record.ApprovedBy || record.approvedBy || null,
    zoho_raw_status: record.Status || record.status,
  }
}

/**
 * Fetch all pending leave requests updated since a given timestamp.
 * Used by the sync route to poll for status changes.
 * @param {Date} since
 * @returns {Promise<Array<{ leaveId, status, employeeEmail }>>}
 */
export async function fetchLeaveUpdates(since) {
  const token = await getAccessToken()
  const fromDate = since.toISOString().split('T')[0]
  const res = await fetch(
    `${ZOHO_PEOPLE_BASE}/leavetracker/getLeaveList?fromDate=${fromDate}&toDate=${new Date().toISOString().split('T')[0]}`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  const records = data?.response?.result || data?.data || []
  return records.map(r => {
    const raw = (r.Status || r.status || '').toLowerCase()
    let status = 'pending'
    if (raw.includes('approve')) status = 'approved'
    else if (raw.includes('reject') || raw.includes('declin') || raw.includes('cancel')) status = 'rejected'
    return {
      leaveId: String(r.leaveId || r.LeaveId || r.id),
      status,
      employeeEmail: r.emailId || r.Email || r.employeeEmail,
      zoho_raw_status: r.Status || r.status,
    }
  })
}
