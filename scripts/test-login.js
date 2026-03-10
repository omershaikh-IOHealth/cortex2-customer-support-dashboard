/**
 * Playwright login diagnostic script
 * Run: node scripts/test-login.js
 */
const { chromium } = require('@playwright/test')

const USERS = [
  { email: 'ann.shruthy@iohealth.com', password: 'W@c62288',   role: 'admin' },
  { email: 'asif.k@iohealth.com',      password: 'Aachi452282@', role: 'agent' },
]

async function testLogin(page, email, password, role) {
  console.log(`\n--- Testing ${role}: ${email} ---`)

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  console.log('  Page URL:', page.url())
  console.log('  Page title:', await page.title())

  // Fill form
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)

  // Capture network requests around signIn
  const responses = []
  page.on('response', res => {
    if (res.url().includes('/api/auth')) {
      responses.push({ url: res.url(), status: res.status() })
    }
  })

  // Submit
  await page.click('button[type="submit"]')

  // Wait for navigation or error message
  await page.waitForTimeout(4000)

  const finalUrl = page.url()
  console.log('  Final URL:', finalUrl)

  // Check for error messages
  const errorEl = await page.$('.text-cortex-danger, [class*="danger"]')
  if (errorEl) {
    console.log('  ERROR shown:', await errorEl.textContent())
  }

  const warnEl = await page.$('.text-cortex-warning, [class*="warning"]')
  if (warnEl) {
    console.log('  WARNING shown:', await warnEl.textContent())
  }

  // Auth API responses
  if (responses.length) {
    console.log('  Auth API calls:')
    responses.forEach(r => console.log(`    ${r.status} ${r.url}`))
  }

  // Check cookies
  const cookies = await page.context().cookies()
  const authCookie = cookies.find(c => c.name.includes('session') || c.name.includes('next-auth') || c.name.includes('authjs'))
  console.log('  Auth cookie:', authCookie ? `${authCookie.name} (set)` : 'NONE')

  const loggedIn = finalUrl.includes('/dashboard') || finalUrl.includes('/briefing')
  console.log('  Result:', loggedIn ? '✓ LOGIN SUCCESS' : '✗ LOGIN FAILED')

  return loggedIn
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [browser error]', msg.text())
  })
  page.on('pageerror', err => console.log('  [page error]', err.message))

  // Also intercept and log the actual POST body + response to /api/auth/callback/credentials
  page.on('response', async res => {
    if (res.url().includes('callback/credentials')) {
      const status = res.status()
      let body = ''
      try { body = await res.text() } catch {}
      console.log(`  [auth callback] ${status}: ${body.substring(0, 300)}`)
    }
  })

  for (const u of USERS) {
    try {
      await testLogin(page, u.email, u.password, u.role)
    } catch (e) {
      console.log('  [playwright error]', e.message)
    }
    // Clear cookies between tests
    await context.clearCookies()
  }

  await browser.close()
  console.log('\nDone.')
})()
