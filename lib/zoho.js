/**
 * Zoho Desk OAuth helper.
 *
 * Required env vars (add to .env.local):
 *   ZOHO_CLIENT_ID
 *   ZOHO_CLIENT_SECRET
 *   ZOHO_REFRESH_TOKEN
 *   ZOHO_ORG_ID          # from Zoho Desk → Setup → Developer Space → API
 *   ZOHO_ORG_DOMAIN      # e.g. desk.zoho.com (default) — your portal URL works too, API domain is auto-detected
 */

let _tokenCache = null // { access_token, expires_at }

export async function getZohoToken() {
  // Serve cached token if still valid (30s buffer)
  if (_tokenCache && Date.now() < _tokenCache.expires_at - 30_000) {
    return _tokenCache.access_token
  }

  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN } = process.env
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error('Zoho credentials not configured (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN missing)')
  }

  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: ZOHO_REFRESH_TOKEN,
    }),
  })

  const data = await res.json()
  if (!data.access_token) throw new Error(`Zoho token refresh failed: ${data.error || JSON.stringify(data)}`)

  _tokenCache = {
    access_token: data.access_token,
    expires_at:   Date.now() + (data.expires_in || 3600) * 1000,
  }
  return _tokenCache.access_token
}

/**
 * Send a reply to a Zoho Desk ticket.
 * @param {string} zohoTicketId - Zoho ticket ID (numeric string)
 * @param {string} content      - HTML or plain-text reply body
 */
export async function sendZohoReply(zohoTicketId, content) {
  const token = await getZohoToken()
  // ZOHO_ORG_DOMAIN can be a full URL (https://support.iohealth.com/) or just a hostname (desk.zoho.com)
  // The Zoho REST API is always at desk.zoho.com (or regional variants like desk.zoho.eu)
  // regardless of any custom portal domain, so we default to desk.zoho.com
  const rawDomain = process.env.ZOHO_ORG_DOMAIN || 'desk.zoho.com'
  const domain = rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'desk.zoho.com'
  // If the domain doesn't contain 'zoho', it's a custom portal URL — fall back to desk.zoho.com
  const apiDomain = domain.includes('zoho') ? domain : 'desk.zoho.com'
  const orgId = process.env.ZOHO_ORG_ID

  if (!orgId) throw new Error('ZOHO_ORG_ID not configured')

  const res = await fetch(
    `https://${apiDomain}/api/v1/tickets/${zohoTicketId}/sendReply`,
    {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        orgId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, contentType: 'html', channel: 'EMAIL' }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Zoho reply failed (${res.status})`)
  }

  return res.json()
}
