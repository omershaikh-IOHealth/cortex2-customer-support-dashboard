const { chromium } = require('playwright')
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const SCREENSHOTS = 'C:/Users/OmerShaikh/Desktop/cortex-screenshots'
const ADMIN = { email: 'ann.shruthy@iohealth.com', password: 'W@c62288' }
const AGENT = { email: 'asif.k@iohealth.com', password: 'Agent@Cortex2025' }
const BASE = 'http://localhost:3000'

const pool = new Pool({
  host: 'aws-1-ap-northeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.alobxvlwznumwikxqewb',
  password: 'dS7R-v.Cu9-#Mf$',
  ssl: { rejectUnauthorized: false }
})

async function db(sql, params = []) {
  try { const r = await pool.query(sql, params); return r.rows; } catch(e) { console.log("  DB ERR:",e.message); return []; }
}

async function shot(page, name) {
  const f = path.join(SCREENSHOTS, `${name}.png`)
  await page.screenshot({ path: f, fullPage: true })
  console.log(`  📸 ${name}.png`)
}

const issues = []
function issue(severity, pg, msg) {
  issues.push({ severity, pg, msg })
  console.log(`  ⚠️  [${severity}][${pg}] ${msg}`)
}

const consoleErrs = []

async function loginAs(page, user) {
  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  const emailSel = 'input[type="email"], input[name="email"], input[id="email"]'
  const passSel  = 'input[type="password"]'
  await page.fill(emailSel, user.email)
  await page.fill(passSel, user.password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3000)
  await page.waitForLoadState('networkidle')
  console.log(`  Logged in as ${user.email} → ${page.url()}`)
}

async function logout(page) {
  // Clear all cookies to invalidate the session, then go to login
  await page.context().clearCookies()
  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  console.log('  Logged out (cookies cleared) → ' + page.url())
}

;(async () => {
  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true })

  const browser = await chromium.launch({ headless: false, slowMo: 400 })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  page.on('console', m => {
    if (m.type() === 'error') consoleErrs.push({ pg: page.url(), msg: m.text() })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. LOGIN PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  1. LOGIN PAGE')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  await shot(page, '01-login')

  const emailField = await page.$('input[type="email"], input[name="email"]')
  const passField  = await page.$('input[type="password"]')
  const submitBtn  = await page.$('button[type="submit"]')
  console.log('  Email field:    ', emailField ? '✅' : '❌')
  console.log('  Password field: ', passField  ? '✅' : '❌')
  console.log('  Submit button:  ', submitBtn  ? '✅' : '❌')
  if (!emailField) issue('CRITICAL', 'login', 'Email input missing')
  if (!passField)  issue('CRITICAL', 'login', 'Password input missing')

  // Empty submit
  if (submitBtn) {
    await submitBtn.click()
    await page.waitForTimeout(800)
    await shot(page, '01b-empty-submit')
    const validationMsg = await page.$('.text-red-500, .text-cortex-danger, [class*="error"]')
    console.log('  Empty-submit validation: ', validationMsg ? '✅ error shown' : '⚠️ no visible error')
    if (!validationMsg) issue('LOW', 'login', 'No visible validation on empty submit')
  }

  // Wrong credentials
  if (emailField && passField) {
    await page.fill('input[type="email"], input[name="email"]', 'hacker@test.com')
    await page.fill('input[type="password"]', 'wrongpass123')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    await shot(page, '01c-wrong-creds')
    const errMsg = await page.$('.text-red-500, .text-cortex-danger, [class*="error"], [role="alert"]')
    console.log('  Wrong-creds error:       ', errMsg ? '✅ error shown' : '⚠️ no visible error')
    if (!errMsg) issue('MEDIUM', 'login', 'Wrong credentials do not show error message')
  }

  // DB: count auth_logs before
  const beforeLogs = await db('SELECT COUNT(*) FROM main.auth_logs')
  const beforeCount = parseInt(beforeLogs[0].count)

  // Correct login
  await page.fill('input[type="email"], input[name="email"]', ADMIN.email)
  await page.fill('input[type="password"]', ADMIN.password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3000)
  await page.waitForLoadState('networkidle')
  console.log('  After login URL: ', page.url())
  await shot(page, '01d-after-login')

  // DB: auth_logs
  await page.waitForTimeout(1000)
  const afterLogs = await db("SELECT email, success, failure_reason, created_at FROM main.auth_logs ORDER BY created_at DESC LIMIT 5")
  console.log('  Recent auth_logs:')
  afterLogs.forEach(r => console.log(`    ${r.failure_reason} | ${r.email} | success=${r.success} | ${r.created_at}`))
  const loginRecorded = afterLogs.some(r => r.email === ADMIN.email)
  if (!loginRecorded) issue('HIGH', 'login', 'Admin login not recorded in main.auth_logs')
  else console.log('  Login in DB: ✅')

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ADMIN DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  2. ADMIN DASHBOARD')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  await shot(page, '02-dashboard')

  // Find KPI card values
  const kpiCardTexts = await page.$$eval('[class*="metric-card"], [class*="MetricCard"], .card', els =>
    els.slice(0, 12).map(e => e.innerText.replace(/\n/g, ' | ').slice(0, 120))
  )
  console.log('  Cards visible:')
  kpiCardTexts.forEach((t, i) => console.log(`    [${i}] ${t}`))

  // DB checks
  const openTix = await db("SELECT COUNT(*) FROM main.tickets WHERE status NOT IN ('Closed','Resolved') AND is_deleted = false ")
  const critSLA = await db("SELECT COUNT(*) FROM main.tickets WHERE sla_status = 'critical' AND is_deleted = false ")
  const ahtData = await db("SELECT ROUND(AVG(talk_time_secs)/60.0,1) as aht FROM main.call_logs WHERE talk_time_secs > 0")
  const fcrData  = await db("SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ticket_id IS NULL) / NULLIF(COUNT(*),0),1) as fcr FROM main.call_logs")

  console.log('  DB: open tickets =', openTix[0].count)
  console.log('  DB: critical SLA =', critSLA[0].count)
  console.log('  DB: AHT (mins)   =', ahtData[0].aht)
  console.log('  DB: FCR%         =', fcrData[0].fcr)

  // Check for any visible error states
  const errStates = await page.$$('[class*="error"], [class*="failed"]')
  if (errStates.length > 0) issue('MEDIUM', 'dashboard', `${errStates.length} error-state elements visible`)

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TICKET LIST
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  3. TICKET LIST')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/tickets')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  await shot(page, '03-ticket-list')

  const dbTotalTix = await db("SELECT COUNT(*) FROM main.tickets WHERE is_deleted = false ")
  console.log('  DB total tickets:', dbTotalTix[0].count)

  const tixRows = await page.$$('tbody tr')
  console.log('  Visible rows:    ', tixRows.length)

  // Check for channel badges
  const pageText = await page.textContent('body')
  const hasVoice = pageText.includes('Voice') || pageText.includes('📞')
  const hasEmail = pageText.includes('Email') || pageText.includes('✉')
  console.log('  Voice badge visible:', hasVoice ? '✅' : '⚠️')
  console.log('  Email badge visible:', hasEmail ? '✅' : '⚠️')
  if (!hasVoice && !hasEmail) issue('MEDIUM', 'tickets', 'No channel badges visible on ticket list')

  // Check VIP star
  const hasVIP = pageText.includes('⭐') || pageText.includes('VIP') || pageText.includes('vip')
  console.log('  VIP indicator:   ', hasVIP ? '✅' : '⚠️ not visible (may be no VIP customers)')

  // Search
  const searchBar = await page.$('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]')
  if (searchBar) {
    await searchBar.fill('test')
    await page.waitForTimeout(1000)
    await shot(page, '03b-search-applied')
    await searchBar.fill('')
    await page.waitForTimeout(500)
    console.log('  Search bar: ✅')
  } else {
    console.log('  Search bar: ⚠️ not found')
    issue('LOW', 'tickets', 'Search bar not found on ticket list')
  }

  // Filters: check for select elements or filter buttons
  const selects = await page.$$('select')
  console.log('  Filter dropdowns:', selects.length)

  // New ticket button
  const newTixBtn = await page.$('button:has-text("New"), button:has-text("Create"), button:has-text("Add Ticket")')
  if (newTixBtn) {
    await newTixBtn.click()
    await page.waitForTimeout(1000)
    const modal = await page.$('[role="dialog"], [class*="modal"], [class*="Modal"]')
    console.log('  New Ticket modal:', modal ? '✅' : '⚠️ no modal')
    await shot(page, '03c-new-ticket-modal')
    if (modal) {
      const cancelBtn = await page.$('button:has-text("Cancel"), [aria-label="Close"]')
      if (cancelBtn) await cancelBtn.click()
      await page.waitForTimeout(500)
    }
  } else {
    console.log('  New Ticket btn:  ⚠️ not found')
    issue('MEDIUM', 'tickets', 'New Ticket button not visible')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. TICKET DETAIL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  4. TICKET DETAIL')
  console.log('══════════════════════════════')

  const sampleTix = await db("SELECT id, title, poc_id, assigned_to_email FROM main.tickets WHERE is_deleted = false ORDER BY created_at DESC LIMIT 1")
  if (sampleTix.length > 0) {
    const tid = sampleTix[0].id
    console.log('  Testing ticket:', tid, '|', sampleTix[0].title?.slice(0, 50))
    await page.goto(BASE + '/tickets/' + tid)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    await shot(page, '04-ticket-detail')

    const bodyTxt = await page.textContent('body')

    // Check elements
    const hasSLATimer = bodyTxt.includes(':') && (bodyTxt.includes('SLA') || bodyTxt.includes('sla'))
    const hasThread   = await page.$('[class*="thread"], [class*="activity"], [class*="Timeline"]')
    const hasAssigned = bodyTxt.includes('Assign') || bodyTxt.includes('assign')
    const hasSentiment = bodyTxt.includes('😊') || bodyTxt.includes('😐') || bodyTxt.includes('😟') || bodyTxt.includes('sentiment') || bodyTxt.includes('Sentiment')
    const hasAISummary = bodyTxt.includes('Summary') || bodyTxt.includes('AI') || bodyTxt.includes('summary')

    console.log('  SLA timer visible:  ', hasSLATimer ? '✅' : '⚠️')
    console.log('  Thread/activity:    ', hasThread ? '✅' : '⚠️')
    console.log('  Assigned agent:     ', hasAssigned ? '✅' : '⚠️')
    console.log('  AI sentiment:       ', hasSentiment ? '✅' : '⚠️')
    console.log('  AI summary:         ', hasAISummary ? '✅' : '⚠️')

    if (!hasThread) issue('HIGH', 'ticket-detail', 'Activity thread not visible on ticket detail')

    // Internal note
    const textarea = await page.$('textarea')
    if (textarea) {
      const placeholder = await textarea.getAttribute('placeholder')
      console.log('  Textarea found (placeholder:', placeholder, ')')
      await textarea.click()
      await textarea.fill('QA automated test note — please ignore')
      await page.waitForTimeout(500)
      // Find submit button near textarea
      const postBtn = await page.$('button:has-text("Post"), button:has-text("Add Note"), button:has-text("Save"), button:has-text("Comment")')
      if (postBtn) {
        await postBtn.click()
        await page.waitForTimeout(2000)
        const noteRow = await db("SELECT body, action_type FROM main.threads WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1", [tid])
        console.log('  Internal note DB:', noteRow.length > 0 ? `✅ "${noteRow[0].body?.slice(0,50)}"` : '❌ not found')
        if (noteRow.length === 0) issue('HIGH', 'ticket-detail', 'Internal note not saved to DB')
      }
    } else {
      console.log('  Textarea: ⚠️ not found')
      issue('MEDIUM', 'ticket-detail', 'No textarea for internal notes found')
    }

    // Escalate button
    const escBtn = await page.$('button:has-text("Escalate")')
    if (escBtn) {
      await escBtn.click()
      await page.waitForTimeout(800)
      await shot(page, '04b-escalate-modal')
      const escModal = await page.$('[role="dialog"]')
      console.log('  Escalate modal: ', escModal ? '✅' : '⚠️')
      if (escModal) {
        // Try submitting empty
        const escSubmit = await page.$('button:has-text("Escalate"), button:has-text("Submit"), button:has-text("Confirm")')
        if (escSubmit) { await escSubmit.click(); await page.waitForTimeout(500) }
        const cancelEsc = await page.$('button:has-text("Cancel")')
        if (cancelEsc) await cancelEsc.click()
        await page.waitForTimeout(500)
      }
    } else {
      console.log('  Escalate btn: ⚠️ not found')
      issue('MEDIUM', 'ticket-detail', 'Escalate button not found on ticket detail')
    }

    // SLA pause button
    const holdBtn = await page.$('button:has-text("Pause"), button:has-text("Hold"), button:has-text("Resume")')
    console.log('  SLA pause/hold: ', holdBtn ? '✅' : '⚠️ not found')

    // Ask AI button
    const askAIBtn = await page.$('button:has-text("Ask AI"), button:has-text("AI")')
    console.log('  Ask AI button:  ', askAIBtn ? '✅' : '⚠️ not found')

    await shot(page, '04c-ticket-detail-full')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SLA MONITOR
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  5. SLA MONITOR')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/sla')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  await shot(page, '05-sla-monitor')

  const slaBodyTxt = await page.textContent('body')
  const slaVisibleRows = await page.$$('tbody tr, [class*="ticket-item"]')
  console.log('  SLA page rows:', slaVisibleRows.length)

  const dbSLATickets = await db("SELECT COUNT(*) FROM main.tickets WHERE COALESCE(sla_consumption_pct,0) >= 70 AND is_deleted = false ")
  console.log('  DB SLA >=70%: ', dbSLATickets[0].count)

  const hasSLABars = slaBodyTxt.includes('%') || await page.$('[class*="progress"], [class*="bar"]')
  console.log('  SLA progress bars: ', hasSLABars ? '✅' : '⚠️')

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. ESCALATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  6. ESCALATIONS')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/escalations')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await shot(page, '06-escalations')

  const escVisRows = await page.$$('tr, [class*="escalat-item"]')
  console.log('  Escalation rows:', escVisRows.length)

  const dbEscTickets = await db("SELECT COUNT(*) FROM main.tickets WHERE escalation_level > 0 AND is_deleted = false ")
  console.log('  DB escalated:   ', dbEscTickets[0].count)

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  7. ANALYTICS')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/analytics')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(4000) // charts
  await shot(page, '07-analytics')

  const chartEls = await page.$$('canvas, [class*="recharts-wrapper"]')
  console.log('  Chart elements:', chartEls.length)
  if (chartEls.length === 0) issue('HIGH', 'analytics', 'No charts rendered')

  const dbChannels = await db("SELECT channel, COUNT(*) cnt FROM main.tickets WHERE is_deleted = false  GROUP BY channel ORDER BY cnt DESC")
  console.log('  DB channels:', JSON.stringify(dbChannels))

  // WoW toggle
  const wowToggle = await page.$('button:has-text("WoW"), button:has-text("Week"), button:has-text("Compare")')
  console.log('  WoW toggle:', wowToggle ? '✅' : '⚠️ not found')

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. QA PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  8. QA PAGE')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/qa')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await shot(page, '08-qa-page')

  const sampleBtn = await page.$('button:has-text("Sample"), button:has-text("Get"), button:has-text("Refresh")')
  if (sampleBtn) {
    await sampleBtn.click()
    await page.waitForTimeout(2000)
    await shot(page, '08b-qa-sampled')
    console.log('  Sample button: ✅')
  } else {
    issue('MEDIUM', 'qa', 'Get Sample button not found')
  }

  const dbFlagged = await db("SELECT id, title, qa_flag_reason FROM main.tickets WHERE flag_for_qa = true AND is_deleted = false LIMIT 5")
  console.log('  DB flagged tickets:', dbFlagged.length)
  dbFlagged.forEach(r => console.log(`    #${r.id} | ${r.title?.slice(0,40)} | ${r.qa_flag_reason}`))

  // Flagged tab
  const flaggedTab = await page.$('button:has-text("Flagged"), [role="tab"]:has-text("Flagged")')
  if (flaggedTab) {
    await flaggedTab.click()
    await page.waitForTimeout(1500)
    await shot(page, '08c-qa-flagged-tab')
    console.log('  Flagged tab: ✅')
  } else {
    console.log('  Flagged tab: ⚠️ not found')
    issue('MEDIUM', 'qa', 'Flagged tab not found on QA page')
  }

  // CSV export
  const exportBtn = await page.$('button:has-text("Export"), button:has-text("CSV")')
  console.log('  CSV export btn: ', exportBtn ? '✅' : '⚠️ not found')

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. SYSTEM LOGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  9. SYSTEM LOGS')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/logs')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await shot(page, '09-system-logs')

  const logVisRows = await page.$$('tr')
  console.log('  Log rows:', logVisRows.length)

  const dbLogs = await db("SELECT status, action_type, created_at FROM main.processing_logs ORDER BY created_at DESC LIMIT 5")
  console.log('  DB processing_logs (latest 5):')
  dbLogs.forEach(r => console.log(`    ${r.action_type || 'n/a'} | ${r.status} | ${r.created_at}`))

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. NOTIFICATIONS PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  10. NOTIFICATIONS')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/notifications')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await shot(page, '10-notifications')

  const notifTabEls = await page.$$eval('button', btns =>
    btns.filter(b => b.offsetParent && ['All','Unread','Escalations','SLA Alerts','Leave','Shift Swaps','System'].some(t => b.textContent.includes(t)))
        .map(b => b.textContent.trim())
  )
  console.log('  Notification tabs:', notifTabEls.join(' | '))
  if (notifTabEls.length < 4) issue('MEDIUM', 'notifications', `Only ${notifTabEls.length} tabs visible (expected 7)`)

  const dbNotifTypes = await db("SELECT type, COUNT(*) cnt FROM main.notifications GROUP BY type ORDER BY cnt DESC")
  console.log('  DB notification types:', JSON.stringify(dbNotifTypes))

  // Test each tab
  for (const tabLabel of ['Unread','Escalations','SLA Alerts','System']) {
    const btn = await page.$(`button:has-text("${tabLabel}")`)
    if (btn) {
      await btn.click()
      await page.waitForTimeout(500)
    }
  }
  // Back to All
  const allTab = await page.$('button:has-text("All")')
  if (allTab) await allTab.click()

  // Clear all button
  const clearAllBtn = await page.$('button:has-text("Clear all"), button:has-text("Clear All")')
  console.log('  Clear all button:', clearAllBtn ? '✅' : '⚠️ not found')

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. KNOWLEDGE BASE (admin)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  11. KNOWLEDGE BASE (admin)')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/knowledge-base')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await shot(page, '11-knowledge-base')

  const kbSearch = await page.$('input[placeholder*="Search" i], input[type="search"]')
  if (kbSearch) {
    await kbSearch.fill('policy')
    await page.waitForTimeout(1000)
    await shot(page, '11b-kb-search')
    await kbSearch.fill('')
    await page.waitForTimeout(500)
    console.log('  KB search: ✅')
  } else {
    console.log('  KB search: ⚠️ not found')
  }

  const createCircBtn = await page.$('button:has-text("New"), button:has-text("Create"), button:has-text("Add")')
  console.log('  Create circular btn (admin):', createCircBtn ? '✅' : '⚠️ not found')

  const dbCirculars = await db("SELECT id, title, is_active FROM main.circulars WHERE is_deleted = false ORDER BY created_at DESC LIMIT 5")
  console.log('  DB circulars:')
  dbCirculars.forEach(r => console.log(`    #${r.id} | ${r.title?.slice(0,40)} | active=${r.is_active}`))

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. ADMIN CONFIG
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  12. ADMIN CONFIG')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/admin')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await shot(page, '12-admin-config')

  // List visible tabs/buttons
  const adminBtns = await page.$$eval('button', btns =>
    btns.filter(b => b.offsetParent !== null && b.textContent.trim().length > 2 && b.textContent.trim().length < 50)
        .map(b => b.textContent.trim()).slice(0, 30)
  )
  console.log('  Admin buttons/tabs:', adminBtns.join(' | '))

  // Click each visible section tab if available
  const sectionNames = ['Companies', 'POCs', 'Users', 'SLA', 'Escalation', 'Rota', 'Circular', 'Agent Status']
  for (const sec of sectionNames) {
    const btn = await page.$(`button:has-text("${sec}")`)
    if (btn) {
      await btn.click()
      await page.waitForTimeout(1000)
      console.log(`  Section "${sec}": ✅`)
    }
  }
  await shot(page, '12b-admin-sections')

  // DB: users check
  const dbUsersAll = await db("SELECT id, full_name, role, email, is_active FROM main.users ORDER BY id")
  console.log('  DB users:')
  dbUsersAll.forEach(u => console.log(`    #${u.id} | ${u.full_name} | ${u.role} | ${u.email} | active=${u.is_active}`))

  // Rota tab specifically
  const rotaBtn = await page.$('button:has-text("ROTA"), button:has-text("Rota")')
  if (rotaBtn) {
    await rotaBtn.click()
    await page.waitForTimeout(2000)
    await shot(page, '12c-rota-section')
    // Look for agent-row grid
    const rotaTable = await page.$('table')
    const tBody = await page.$('tbody')
    const rotaRows = tBody ? await page.$$('tbody tr') : []
    console.log('  Rota table rows:', rotaRows.length)
    if (rotaRows.length === 0) issue('MEDIUM', 'rota', 'Rota grid shows no agent rows')

    // Leave tab
    const leaveTab = await page.$('button:has-text("Leave")')
    if (leaveTab) {
      await leaveTab.click()
      await page.waitForTimeout(1000)
      await shot(page, '12d-rota-leave')
      console.log('  Leave tab: ✅')
      const dbLeave = await db("SELECT id, user_id, status, start_date, end_date FROM main.leave_requests WHERE status = 'pending' LIMIT 5")
      console.log('  DB pending leaves:', dbLeave.length)
    }

    const swapsTab = await page.$('button:has-text("Swap")')
    if (swapsTab) {
      await swapsTab.click()
      await page.waitForTimeout(1000)
      await shot(page, '12e-rota-swaps')
      console.log('  Swaps tab: ✅')
    }
  }

  // Agent Status section
  const agentStatusBtn = await page.$('button:has-text("Agent Status"), button:has-text("Status Viewer")')
  if (agentStatusBtn) {
    await agentStatusBtn.click()
    await page.waitForTimeout(2000)
    await shot(page, '12f-agent-status')
    const agentStatusRows = await page.$$('tbody tr')
    console.log('  Agent status rows:', agentStatusRows.length)

    // Try expanding timeline
    const firstExpandBtn = await page.$('tbody tr td button')
    if (firstExpandBtn) {
      await firstExpandBtn.click()
      await page.waitForTimeout(2000)
      await shot(page, '12g-agent-status-timeline')
      console.log('  Status timeline expand: ✅')
    } else {
      console.log('  Status timeline expand: ⚠️ no expand button in rows')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. AI COMPANION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  13. AI COMPANION')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  const aiBtn = await page.$('[class*="AICompanion"], [class*="ai-companion"], button[aria-label*="AI" i], [class*="companion"]')
  if (aiBtn) {
    await aiBtn.click()
    await page.waitForTimeout(1500)
    await shot(page, '13-ai-companion-open')
    console.log('  AI Companion panel: ✅')

    // Type a question
    const aiInput = await page.$('input[placeholder*="Ask" i], textarea[placeholder*="Ask" i], input[placeholder*="message" i]')
    if (aiInput) {
      await aiInput.fill('How many open tickets are there right now?')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(5000) // wait for AI response
      await shot(page, '13b-ai-response')
      console.log('  AI response waited 5s')
    }
  } else {
    // Try floating button
    const floatBtn = await page.$('button[class*="fixed"], [class*="float"]')
    if (floatBtn) {
      await floatBtn.click()
      await page.waitForTimeout(1000)
      await shot(page, '13-ai-companion-float')
      console.log('  AI Companion (float): ✅')
    } else {
      console.log('  AI Companion: ⚠️ not found')
      issue('MEDIUM', 'ai-companion', 'AI Companion button not found on dashboard')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ZIWO CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  14. ZIWO WIDGET (admin check)')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  const ziwoWidget = await page.$('[class*="ZiwoWidget"], [class*="ziwo"], [class*="dialpad"], [class*="phone-widget"]')
  const ziwoText = await page.textContent('body')
  const hasDialpad = ziwoText.includes('Dialpad') || ziwoText.includes('dialpad') || ziwoText.includes('ZIWO')
  console.log('  ZIWO widget visible for admin:', hasDialpad ? '⚠️ PRESENT (should not be)' : '✅ Not visible (correct)')
  if (hasDialpad) issue('MEDIUM', 'ziwo', 'ZIWO/Dialpad widget visible for admin account — should be agent-only')

  // ═══════════════════════════════════════════════════════════════════════════
  // ROLE GUARD TEST
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  15. ROLE GUARD TEST')
  console.log('══════════════════════════════')

  // While logged in as admin, try to access an agent-only page
  await page.goto(BASE + '/briefing')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const briefingUrlAfter = page.url()
  console.log('  Admin → /briefing redirects to:', briefingUrlAfter)
  if (briefingUrlAfter.includes('/briefing')) {
    issue('HIGH', 'auth', 'Admin can access /briefing (agent-only page) — no redirect')
  } else {
    console.log('  Role guard (/briefing for admin): ✅ redirected')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOG OUT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  LOGOUT & SWITCH TO AGENT')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await logout(page)
  await page.waitForTimeout(1500)
  await shot(page, '16-logged-out')

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  16. AGENT LOGIN')
  console.log('══════════════════════════════')

  await loginAs(page, AGENT)
  await shot(page, '16b-agent-post-login')

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. AGENT DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  17. AGENT DASHBOARD')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/agent-dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  await shot(page, '17-agent-dashboard')

  const agentBodyTxt = await page.textContent('body')
  const agentDBUser = await db("SELECT id, full_name, email FROM main.users WHERE email = $1", [AGENT.email])
  console.log('  Agent DB user:', JSON.stringify(agentDBUser[0]))

  if (agentDBUser.length > 0) {
    const agentId = agentDBUser[0].id
    const agentTix = await db("SELECT COUNT(*) FROM main.tickets WHERE assigned_to_email = $1 AND is_deleted = false", [AGENT.email])
    console.log('  DB agent tickets:', agentTix[0].count)
  }

  const agentCards = await page.$$('.card')
  console.log('  Agent dashboard cards:', agentCards.length)

  // Check ZIWO is present for agent
  const ziwoForAgent = agentBodyTxt.includes('ZIWO') || agentBodyTxt.includes('Dialpad') || agentBodyTxt.includes('Connected') || agentBodyTxt.includes('Connecting')
  console.log('  ZIWO widget for agent:', ziwoForAgent ? '✅' : '⚠️ not detected in text')

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. AGENT MY TICKETS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  18. AGENT MY TICKETS')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/my-tickets')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  await shot(page, '18-my-tickets')

  const myTixBodyTxt = await page.textContent('body')
  // 3-panel check
  const panelDivs = await page.$$('[class*="panel"], [class*="col-span"]')
  console.log('  Panel divs found:', panelDivs.length)

  const hasVoiceFilter = myTixBodyTxt.includes('Voice')
  const hasEmailFilter = myTixBodyTxt.includes('Email')
  console.log('  Voice filter tab:', hasVoiceFilter ? '✅' : '⚠️')
  console.log('  Email filter tab:', hasEmailFilter ? '✅' : '⚠️')
  if (!hasVoiceFilter || !hasEmailFilter) {
    issue('LOW', 'my-tickets', 'Voice/Email channel filter tabs not visible')
  }

  // Click first ticket
  const firstTixItem = await page.$('[class*="ticket-item"], tbody tr, [class*="list-item"]')
  if (firstTixItem) {
    await firstTixItem.click()
    await page.waitForTimeout(1500)
    await shot(page, '18b-my-tickets-selected')
    console.log('  Ticket selection: ✅')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. AGENT BRIEFING
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  19. AGENT BRIEFING')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/briefing')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)
  await shot(page, '19-briefing')

  const briefBodyTxt = await page.textContent('body')
  const hasShiftInfo = briefBodyTxt.includes(':') // time format HH:MM
  const hasAckBtn = await page.$('button:has-text("Acknowledge"), button:has-text("Acknowledg")')
  const hasLeaveBtn = await page.$('button:has-text("Leave"), button:has-text("Request Leave")')
  const hasSessionTimer = briefBodyTxt.includes('Session') || briefBodyTxt.includes('session')
  const hasStatusTimeline = briefBodyTxt.includes('Timeline') || briefBodyTxt.includes('timeline') || briefBodyTxt.includes('Status')

  console.log('  Shift info:       ', hasShiftInfo ? '✅' : '⚠️')
  console.log('  Acknowledge btn:  ', hasAckBtn ? '✅' : '⚠️')
  console.log('  Leave request btn:', hasLeaveBtn ? '✅' : '⚠️')
  console.log('  Session timer:    ', hasSessionTimer ? '✅' : '⚠️')
  console.log('  Status timeline:  ', hasStatusTimeline ? '✅' : '⚠️')

  if (!hasAckBtn) issue('MEDIUM', 'briefing', 'Acknowledge Shift button not found')

  // DB: agent shift today
  if (agentDBUser.length > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const agentShift = await db("SELECT * FROM main.shift_rotas WHERE user_id = $1 AND shift_date = $2", [agentDBUser[0].id, today])
    console.log('  DB shift today:', agentShift.length > 0 ? JSON.stringify(agentShift[0]) : 'No shift today')

    const agentBriefAck = await db("SELECT * FROM main.briefing_acks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [agentDBUser[0].id])
    console.log('  DB briefing acks:', agentBriefAck.length)
  }

  // Click Acknowledge if present
  if (hasAckBtn) {
    const ackBtn = await page.$('button:has-text("Acknowledge")')
    if (ackBtn) {
      const isDisabled = await ackBtn.isDisabled()
      console.log('  Ack btn disabled:', isDisabled)
      if (!isDisabled) {
        await ackBtn.click()
        await page.waitForTimeout(1500)
        await shot(page, '19b-briefing-acknowledged')
        console.log('  Clicked Acknowledge: ✅')
      }
    }
  }

  // Navigate to yesterday
  const prevDayBtn = await page.$('button[class*="btn-secondary"]:has([class*="ChevronLeft"]), button:has(svg)')
  const backBtns = await page.$$('button')
  console.log('  Navigation buttons total:', backBtns.length)

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. KNOWLEDGE BASE (agent)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  20. KNOWLEDGE BASE (agent)')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/knowledge-base')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await shot(page, '20-kb-agent')

  const kbAgentTxt = await page.textContent('body')
  const hasCreateBtnAgent = await page.$('button:has-text("New"), button:has-text("Create"), button:has-text("Add")')
  console.log('  Create button for agent:', hasCreateBtnAgent ? '⚠️ VISIBLE (should be hidden)' : '✅ Hidden (correct)')
  if (hasCreateBtnAgent) issue('MEDIUM', 'knowledge-base', 'Create button visible for agent — should be admin-only')

  // ═══════════════════════════════════════════════════════════════════════════
  // 21. AGENT → ADMIN PAGE GUARD
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  21. ROLE GUARD (agent→admin)')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const agentToDashUrl = page.url()
  console.log('  Agent → /dashboard → ', agentToDashUrl)
  if (agentToDashUrl.includes('/dashboard')) {
    issue('CRITICAL', 'auth', 'Agent can access /dashboard (admin-only) — no redirect')
  } else {
    console.log('  Role guard (/dashboard for agent): ✅')
  }

  await page.goto(BASE + '/admin')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const agentToAdminUrl = page.url()
  console.log('  Agent → /admin → ', agentToAdminUrl)
  if (agentToAdminUrl.includes('/admin') && !agentToAdminUrl.includes('/agent-dashboard')) {
    issue('CRITICAL', 'auth', 'Agent can access /admin page — no redirect')
  } else {
    console.log('  Role guard (/admin for agent): ✅')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 22. ZIWO WIDGET (agent)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  22. ZIWO WIDGET (agent)')
  console.log('══════════════════════════════')

  await page.goto(BASE + '/agent-dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)
  await shot(page, '22-ziwo-agent')

  const ziwoAgentTxt = await page.textContent('body')
  const ziwoVisible = ziwoAgentTxt.includes('ZIWO') || ziwoAgentTxt.includes('Dialpad') || ziwoAgentTxt.includes('Connected') || ziwoAgentTxt.includes('Connecting') || ziwoAgentTxt.includes('No ZIWO') || ziwoAgentTxt.includes('loading')
  console.log('  ZIWO widget present: ', ziwoVisible ? '✅' : '⚠️ no ZIWO text found')

  const statusSelector = await page.$('[class*="status"], select')
  console.log('  Status selector:', statusSelector ? '✅' : '⚠️')

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSOLE ERRORS SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════')
  console.log('  CONSOLE ERRORS')
  console.log('══════════════════════════════')

  if (consoleErrs.length === 0) {
    console.log('  No console errors ✅')
  } else {
    const unique = [...new Set(consoleErrs.map(e => e.msg.slice(0, 100)))]
    unique.forEach(e => console.log(`  ❌ ${e}`))
    issue('HIGH', 'console', `${consoleErrs.length} console errors collected across all pages`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL ISSUES SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n\n╔══════════════════════════════════════════════════╗')
  console.log('║           FINAL ISSUES SUMMARY                  ║')
  console.log('╚══════════════════════════════════════════════════╝')

  const severities = ['CRITICAL','HIGH','MEDIUM','LOW']
  severities.forEach(sev => {
    const found = issues.filter(i => i.severity === sev)
    if (found.length > 0) {
      console.log(`\n  ── ${sev} (${found.length}) ──`)
      found.forEach(i => console.log(`    [${i.pg}] ${i.msg}`))
    }
  })

  if (issues.length === 0) console.log('\n  No issues found! ✅')
  console.log('\n  Total issues:', issues.length)

  // Write issues to file
  fs.writeFileSync('C:/Users/OmerShaikh/Desktop/cortex-qa-issues.json', JSON.stringify(issues, null, 2))
  console.log('\n  Issues saved to cortex-qa-issues.json')

  await browser.close()
  await pool.end()
  console.log('\n✅ QA run complete.')
})()
