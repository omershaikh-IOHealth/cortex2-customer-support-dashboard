/**
 * /api/seed — DB diagnostic + data seeder
 *
 * GET /api/seed?key=AUTH_SECRET          → dry-run: show counts & what's missing
 * GET /api/seed?key=AUTH_SECRET&seed=true → insert seed data
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING / checks before inserting.
 * Covers: agents, voice tickets, call_logs, qa_scores (on existing + new tickets), threads.
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import bcrypt from 'bcryptjs'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ─── Reference data ───────────────────────────────────────────────────────────

const MODULES = [
  'Claims Processing', 'Policy Inquiries', 'Network / Provider',
  'Member Portal', 'Billing & Payments', 'Approvals & Authorizations',
  'Complaints', 'General Inquiry',
]
const PRIORITIES   = ['P1', 'P2', 'P2', 'P3', 'P3', 'P3', 'P4', 'P4']
const STATUSES     = ['Open', 'In Progress', 'In Progress', 'Pending Customer', 'Resolved', 'Closed']
const SENTIMENTS   = ['positive', 'positive', 'neutral', 'neutral', 'neutral', 'negative', 'negative']
const REQUEST_TYPES = ['New Request', 'Issue', 'Inquiry', 'Complaint', 'Technical Issue']
const CASE_TYPES   = ['Standard', 'Urgent', 'Follow-up', 'Escalated', 'VIP']
const QUEUE_NAMES  = ['Medical Claims', 'Policy Support', 'Provider Relations', 'Member Services', 'Billing Queue']
const CUSTOMERS = [
  { name: 'Ahmad Al-Farsi',    email: 'ahmad.farsi@gmail.com' },
  { name: 'Noura Al-Hamdan',   email: 'noura.hamdan@outlook.com' },
  { name: 'Khalid Mansouri',   email: 'khalid.m@yahoo.com' },
  { name: 'Sara Al-Khatib',    email: 'sara.khatib@gmail.com' },
  { name: 'Omar Al-Sulaiman',  email: 'omar.s@hotmail.com' },
  { name: 'Fatima Rahimi',     email: 'fatima.rahimi@gmail.com' },
  { name: 'Hassan Al-Nouri',   email: 'hassan.nouri@outlook.com' },
  { name: 'Layla Al-Mansouri', email: 'layla.m@gmail.com' },
  { name: 'Yusuf Al-Rashid',   email: 'yusuf.rashid@hotmail.com' },
  { name: 'Mariam Khalil',     email: 'mariam.k@gmail.com' },
]
const VOICE_TITLES = [
  'Caller inquiring about claim status',
  'Customer requesting policy details over the phone',
  'Pre-authorization query via call',
  'Member portal issue reported via call',
  'Billing dispute raised by phone',
  'Referral approval requested via call',
  'Provider network inquiry by phone',
  'Complaint lodged via inbound call',
  'Emergency claim notification',
  'Renewal reminder callback',
  'Lab result authorization needed',
  'Prescription coverage query',
  'Hospital admission pre-approval call',
  'ID card replacement request by phone',
  'General benefits inquiry via call',
]

// 12 QA categories (must match QAScorecardPanel.js)
const QA_CATEGORIES = [
  { key: 'greeting',              weight: 5  },
  { key: 'verification',          weight: 10 },
  { key: 'problem_understanding', weight: 10 },
  { key: 'empathy',               weight: 10 },
  { key: 'accuracy',              weight: 15 },
  { key: 'process_compliance',    weight: 10 },
  { key: 'resolution_quality',    weight: 15 },
  { key: 'communication_clarity', weight: 5  },
  { key: 'ownership',             weight: 5  },
  { key: 'closing',               weight: 5  },
  { key: 'documentation',         weight: 5  },
  { key: 'crm_hygiene',           weight: 5  },
]

const COACHING_NOTES = [
  'Focus on active listening — agent interrupted customer twice before issue was fully explained.',
  'Good empathy shown but documentation was incomplete at close of call.',
  'Verification steps skipped on second call. Needs refresher on ID check policy.',
  'Resolution quality is improving. Recommend review of pre-auth SOP.',
  'Excellent call — clear communication, thorough documentation, professional close.',
  null,
]

function generateQAScores(profile = 'good') {
  const ranges = { excellent: [4, 5], good: [3, 5], average: [2, 4], poor: [1, 3] }
  const [min, max] = ranges[profile] || [3, 5]
  const scores = {}
  QA_CATEGORIES.forEach(c => { scores[c.key] = randInt(min, max) })
  return scores
}

function calcTotal(scores, critFlags = {}) {
  let total = QA_CATEGORIES.reduce((sum, cat) => {
    return sum + ((scores[cat.key] ?? 0) / 5) * cat.weight
  }, 0)
  if (Object.values(critFlags).some(Boolean)) total = Math.max(0, total - 25)
  return Math.round(total)
}

function calcResult(score, critFlags = {}) {
  if (Object.values(critFlags).some(Boolean)) return 'critical_fail'
  if (score >= 85) return 'pass'
  if (score >= 70) return 'borderline'
  if (score >= 50) return 'coaching_required'
  return 'fail'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const key    = searchParams.get('key')
  const doSeed = searchParams.get('seed') === 'true'

  if (!key || key.trim() !== process.env.AUTH_SECRET?.trim()) {
    return NextResponse.json({ error: 'Missing or invalid key. Pass ?key=AUTH_SECRET' }, { status: 401 })
  }

  const log = []

  try {
    // ── Ensure schema additions ───────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS main.qa_scores (
        id                SERIAL PRIMARY KEY,
        ticket_id         INTEGER REFERENCES main.tickets(id) ON DELETE CASCADE,
        agent_id          INTEGER REFERENCES main.users(id)   ON DELETE SET NULL,
        reviewer_id       INTEGER REFERENCES main.users(id)   ON DELETE SET NULL,
        supervisor_id     INTEGER REFERENCES main.users(id)   ON DELETE SET NULL,
        company_code      VARCHAR(50) DEFAULT 'medgulf',
        scores            JSONB DEFAULT '{}',
        critical_flags    JSONB DEFAULT '{}',
        coaching_notes    TEXT,
        follow_up_action  VARCHAR(500),
        follow_up_date    DATE,
        improvement_themes JSONB DEFAULT '[]',
        total_score       NUMERIC(5,2),
        result            VARCHAR(30),
        reviewed_at       TIMESTAMP DEFAULT NOW(),
        created_at        TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE main.tickets ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255);
      ALTER TABLE main.tickets ADD COLUMN IF NOT EXISTS qa_flagged      BOOLEAN DEFAULT false;
      ALTER TABLE main.tickets ADD COLUMN IF NOT EXISTS qa_flag_reason  TEXT;
      ALTER TABLE main.tickets ADD COLUMN IF NOT EXISTS qa_flagged_at   TIMESTAMP;
      ALTER TABLE main.tickets ADD COLUMN IF NOT EXISTS qa_flagged_by   INT REFERENCES main.users(id) ON DELETE SET NULL;
    `)

    // ── Read company / solution ───────────────────────────────────────────────
    const coR = await pool.query(`SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1`)
    const companyId  = coR.rows[0]?.id || null
    const solR = companyId ? await pool.query(`SELECT id FROM main.solutions WHERE company_id = $1 LIMIT 1`, [companyId]) : { rows: [] }
    const solutionId = solR.rows[0]?.id || null

    const countQ = async (table, where = '') => {
      const r = await pool.query(`SELECT COUNT(*) FROM ${table}${where ? ` WHERE ${where}` : ''}`)
      return parseInt(r.rows[0].count)
    }

    const [totalAgents, totalEmail, totalVoice, totalCallLogs, totalQAScores] = await Promise.all([
      countQ('main.users', `role = 'agent' AND is_active = true`),
      countQ('main.tickets', `company_id = ${companyId || 0} AND channel = 'email' AND (is_deleted = false OR is_deleted IS NULL)`),
      countQ('main.tickets', `company_id = ${companyId || 0} AND channel = 'voice' AND (is_deleted = false OR is_deleted IS NULL)`),
      countQ('main.call_logs'),
      countQ('main.qa_scores', `company_code = 'medgulf'`),
    ])

    log.push('── Diagnostic ─────────────────────────────────────────')
    log.push(`Company/Solution: id=${companyId}, solution_id=${solutionId}`)
    log.push(`Agents:           ${totalAgents}`)
    log.push(`Tickets (email):  ${totalEmail}`)
    log.push(`Tickets (voice):  ${totalVoice}`)
    log.push(`Call logs:        ${totalCallLogs}`)
    log.push(`QA scores:        ${totalQAScores}`)

    const needs = []
    if (totalAgents < 4)    needs.push(`✗ Agents: ${totalAgents} — will add 4 agents`)
    if (totalVoice < 15)    needs.push(`✗ Voice tickets: ${totalVoice} — will add ${25 - totalVoice}`)
    if (totalQAScores < 10) needs.push(`✗ QA scores: ${totalQAScores} — will add 20 reviews (email + voice tickets)`)
    if (!needs.length)      needs.push('✓ All data present')

    log.push('', '── Plan ────────────────────────────────────────────────')
    needs.forEach(n => log.push(n))

    if (!doSeed) {
      log.push('', 'Pass ?seed=true to execute.')
      return NextResponse.json({ success: true, dry_run: true, log })
    }

    // ════════════════════════════════════════════════════════════════════════
    // SEED EXECUTION
    // ════════════════════════════════════════════════════════════════════════
    log.push('', '── Seeding ─────────────────────────────────────────────')

    // ── 1. Agents ─────────────────────────────────────────────────────────────
    const SEED_AGENTS = [
      { email: 'sarah.alrashidi@iohealth.com', full_name: 'Sarah Al-Rashidi', password: 'Agent@2025' },
      { email: 'mohammed.hassan@iohealth.com', full_name: 'Mohammed Hassan',  password: 'Agent@2025' },
      { email: 'fatima.alzaabi@iohealth.com',  full_name: 'Fatima Al-Zaabi',  password: 'Agent@2025' },
      { email: 'khalid.ahmed@iohealth.com',    full_name: 'Khalid Ahmed',     password: 'Agent@2025' },
    ]
    const agentIds = []
    for (const a of SEED_AGENTS) {
      const hash = await bcrypt.hash(a.password, 10)
      const r = await pool.query(
        `INSERT INTO main.users (email, password_hash, full_name, role, is_active)
         VALUES ($1,$2,$3,'agent',true)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW()
         RETURNING id, full_name, email`,
        [a.email, hash, a.full_name]
      )
      agentIds.push(r.rows[0])
      await pool.query(
        `INSERT INTO main.agent_status (user_id, status, set_at) VALUES ($1,'available',NOW()) ON CONFLICT (user_id) DO NOTHING`,
        [r.rows[0].id]
      )
    }
    log.push(`✓ Agents: ${agentIds.map(a => a.full_name).join(', ')}`)

    // Also assign existing un-assigned email tickets to these agents (backfill)
    const unassignedR = await pool.query(
      `SELECT id FROM main.tickets WHERE company_id = $1 AND assigned_to_id IS NULL AND (is_deleted = false OR is_deleted IS NULL) LIMIT 50`,
      [companyId]
    )
    for (const t of unassignedR.rows) {
      const agent = rand(agentIds)
      await pool.query(
        `UPDATE main.tickets SET assigned_to_id = $1, assigned_to_name = $2, assigned_to_email = $3 WHERE id = $4`,
        [agent.id, agent.full_name, agent.email, t.id]
      )
    }
    if (unassignedR.rows.length) log.push(`✓ Assigned ${unassignedR.rows.length} existing tickets to agents`)

    // Get admin for reviewer role in QA
    const adminR = await pool.query(`SELECT id FROM main.users WHERE role = 'admin' LIMIT 1`)
    const adminId = adminR.rows[0]?.id || agentIds[0].id

    // ── 2. Voice tickets ──────────────────────────────────────────────────────
    const voiceToAdd = Math.max(0, 25 - totalVoice)
    const newVoiceIds = []

    for (let i = 0; i < voiceToAdd; i++) {
      const module    = rand(MODULES)
      const priority  = rand(PRIORITIES)
      const status    = rand(STATUSES)
      const customer  = rand(CUSTOMERS)
      const agent     = rand(agentIds)
      const daysBack  = randInt(1, 85)
      const createdAt = daysAgo(daysBack)
      const slaHrs    = priority === 'P1' ? 4 : priority === 'P2' ? 8 : priority === 'P3' ? 24 : 72
      const slaDue    = new Date(new Date(createdAt).getTime() + slaHrs * 3600000).toISOString()
      const consumed  = randInt(10, 130)
      const slaStatus = consumed >= 100 ? 'breached' : consumed >= 85 ? 'critical' : consumed >= 65 ? 'warning' : 'healthy'
      const resolvedAt = ['Resolved', 'Closed'].includes(status)
        ? new Date(new Date(createdAt).getTime() + randInt(3600000, slaHrs * 3600000 * 0.9)).toISOString()
        : null

      const r = await pool.query(
        `INSERT INTO main.tickets (
          company_id, solution_id, title, module, priority, status, channel,
          request_type, case_type, created_by_name, created_by_email,
          assigned_to_id, assigned_to_email, assigned_to_name,
          ai_sentiment, sla_resolution_due, sla_consumption_pct, sla_status,
          escalation_level, is_deleted, created_at, resolved_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'voice',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,false,$18,$19)
        RETURNING id, assigned_to_id, assigned_to_name`,
        [
          companyId, solutionId,
          rand(VOICE_TITLES), module, priority, status,
          rand(REQUEST_TYPES), rand(CASE_TYPES),
          customer.name, customer.email,
          agent.id, agent.email, agent.full_name,
          rand(SENTIMENTS), slaDue, consumed, slaStatus,
          createdAt, resolvedAt,
        ]
      )
      if (r.rows[0]) newVoiceIds.push(r.rows[0])
    }
    log.push(`✓ Voice tickets: ${newVoiceIds.length} inserted`)

    // ── 3. Call logs for the new voice tickets ────────────────────────────────
    let callsInserted = 0
    for (const t of newVoiceIds) {
      const duration  = randInt(60, 900)
      const talkTime  = Math.floor(duration * 0.85)
      const holdTime  = duration - talkTime
      const startedAt = daysAgo(randInt(1, 85))
      const answeredAt = new Date(new Date(startedAt).getTime() + randInt(5, 30) * 1000).toISOString()
      const endedAt   = new Date(new Date(answeredAt).getTime() + duration * 1000).toISOString()

      await pool.query(
        `INSERT INTO main.call_logs (
          primary_call_id, agent_id, direction, customer_number, queue_name,
          duration_secs, talk_time_secs, hold_time_secs,
          hangup_cause, hangup_by, status, ticket_id,
          started_at, answered_at, ended_at
        ) VALUES ($1,$2,'inbound',$3,$4,$5,$6,$7,'normal_clearing','agent','ended',$8,$9,$10,$11)
        ON CONFLICT (primary_call_id) DO NOTHING`,
        [
          `SEED-CALL-${t.id}-${Date.now()}`,
          t.assigned_to_id,
          `+971${randInt(500000000, 599999999)}`,
          rand(QUEUE_NAMES),
          duration, talkTime, holdTime,
          t.id, startedAt, answeredAt, endedAt,
        ]
      )
      callsInserted++
    }
    log.push(`✓ Call logs: ${callsInserted} inserted for new voice tickets`)

    // ── 4. QA scores ──────────────────────────────────────────────────────────
    // Score existing email tickets + new voice tickets
    const existingTicketsR = await pool.query(
      `SELECT id, assigned_to_id, assigned_to_name, channel
       FROM main.tickets
       WHERE company_id = $1
         AND assigned_to_id IS NOT NULL
         AND (is_deleted = false OR is_deleted IS NULL)
       ORDER BY RANDOM()
       LIMIT 30`,
      [companyId]
    )
    const scoreable = existingTicketsR.rows

    const QA_PROFILES = ['excellent', 'excellent', 'good', 'good', 'good', 'average', 'average', 'poor']
    const IMPROVEMENT_THEMES_LIST = ['active_listening', 'product_knowledge', 'process_adherence', 'documentation', 'communication_clarity', 'escalation_handling']

    let qaInserted = 0
    const toScore = Math.min(scoreable.length, 20)

    for (let i = 0; i < toScore; i++) {
      const t       = scoreable[i]
      const profile = rand(QA_PROFILES)
      const scores  = generateQAScores(profile)
      const hasCrit = profile === 'poor' && Math.random() < 0.25
      const critFlags = hasCrit ? { misleading_info: true } : {}
      const total   = calcTotal(scores, critFlags)
      const result  = calcResult(total, critFlags)
      const coaching = result !== 'pass' ? rand(COACHING_NOTES) : null
      const themes  = result !== 'pass' ? [rand(IMPROVEMENT_THEMES_LIST)] : []

      await pool.query(
        `INSERT INTO main.qa_scores (
          ticket_id, agent_id, reviewer_id, company_code,
          scores, critical_flags, coaching_notes, improvement_themes,
          total_score, result, reviewed_at
        ) VALUES ($1,$2,$3,'medgulf',$4,$5,$6,$7,$8,$9,$10)`,
        [
          t.id, t.assigned_to_id, adminId,
          JSON.stringify(scores),
          JSON.stringify(critFlags),
          coaching,
          JSON.stringify(themes),
          total, result,
          daysAgo(randInt(0, 25)),
        ]
      )
      qaInserted++
    }
    log.push(`✓ QA scores: ${qaInserted} reviews inserted (${scoreable.filter(t => t.channel === 'email').length > 0 ? 'email + voice' : 'mixed'} tickets)`)

    // ── 5. Final counts ───────────────────────────────────────────────────────
    const [fAgents, fEmail, fVoice, fCalls, fQA] = await Promise.all([
      countQ('main.users', `role = 'agent' AND is_active = true`),
      countQ('main.tickets', `company_id = ${companyId || 0} AND channel = 'email' AND (is_deleted = false OR is_deleted IS NULL)`),
      countQ('main.tickets', `company_id = ${companyId || 0} AND channel = 'voice' AND (is_deleted = false OR is_deleted IS NULL)`),
      countQ('main.call_logs'),
      countQ('main.qa_scores', `company_code = 'medgulf'`),
    ])

    log.push('', '── Final counts ─────────────────────────────────────────')
    log.push(`Agents:          ${fAgents}`)
    log.push(`Email tickets:   ${fEmail}`)
    log.push(`Voice tickets:   ${fVoice}`)
    log.push(`Call logs:       ${fCalls}`)
    log.push(`QA scores:       ${fQA}`)
    log.push('', '✓ Seed complete.')

    return NextResponse.json({
      success: true,
      seeded:  true,
      agents:  agentIds.map(a => ({ id: a.id, name: a.full_name, email: a.email, password: 'Agent@2025' })),
      log,
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message, log }, { status: 500 })
  }
}
