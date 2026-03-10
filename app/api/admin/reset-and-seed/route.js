/**
 * POST /api/admin/reset-and-seed?key=AUTH_SECRET
 *
 * Full demo data reset and repopulation:
 *   Step 1 — Delete all ClickUp tasks from CLICKUP_LIST_ID
 *   Step 2 — Truncate all transactional DB tables (preserves users, config, credentials)
 *   Step 3 — Seed 60 tickets backtracked 1–90 days (with ClickUp push for channel='clickup')
 *   Step 4 — Seed 80 call logs (last 30 days)
 *   Step 5 — Seed QA scores, agent status history, shift rotas
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { createClickUpTask } from '@/lib/clickup'

export const maxDuration = 300

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function daysAgoTs(d) {
  const base = new Date()
  base.setDate(base.getDate() - d)
  base.setHours(randInt(7, 20), randInt(0, 59), randInt(0, 59), 0)
  return base.toISOString()
}

// ─── QA helpers (matches QAScorecardPanel.js categories) ──────────────────────

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

function generateQAScores(profile) {
  const ranges = { excellent: [4, 5], good: [3, 5], average: [2, 4], poor: [1, 3] }
  const [min, max] = ranges[profile] || [3, 5]
  const scores = {}
  QA_CATEGORIES.forEach(c => { scores[c.key] = randInt(min, max) })
  return scores
}

function calcTotal(scores, critFlags = {}) {
  let total = QA_CATEGORIES.reduce((sum, cat) => sum + ((scores[cat.key] ?? 0) / 5) * cat.weight, 0)
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

// ─── Reference data ───────────────────────────────────────────────────────────

const TICKET_TITLES = [
  'Unable to log in to MedGulf mobile app',
  'Pre-authorization request stuck in pending state',
  'Claim submitted 30 days ago with no update',
  'App crashes when opening My Health section',
  'Digital Twin shows incorrect health data',
  'Prescription coverage query — urgent',
  'Policy renewal notification not received',
  'Provider network search not returning results',
  'Appointment booking fails at confirmation step',
  'Billing statement shows incorrect amount',
  'ID card replacement required urgently',
  'Referral approval needed for specialist visit',
  'Hospital admission pre-approval not processing',
  'Lab test results missing from patient app',
  'AI Companion not responding to queries',
  'Language setting reverts to Arabic after restart',
  'Landing page loading error on iOS 17',
  'Cash claim reimbursement overdue 60 days',
  'Login OTP not received via SMS',
  'App performance slow during peak hours',
  'Integration with third-party lab system broken',
  'Security alert — unauthorized access attempt detected',
  'Member portal password reset not working',
  'Data sync issue between app and backend',
  'Push notifications not reaching member device',
  'Wellness challenge points not accumulating',
  'Call Doctor Now feature unavailable',
  'Incorrect deductible amount shown on claim',
  'Claim auto-rejected without proper review',
  'Enhancement request: export claims history to PDF',
  'Provider availability not updating in real-time',
  'Member profile data partially lost after update',
  'Annual checkup appointment booking bug',
  'Telemedicine session disconnecting mid-call',
  'Insurance card QR code not scanning at clinic',
  'Dependents not showing under member account',
  'Prior authorization appeal process unclear',
  'App does not support accessibility features',
  'Coverage details showing outdated plan information',
  'System maintenance window not communicated to users',
  'Duplicate claim submission detected',
  'Agent unable to access member records in portal',
  'SLA breach on critical pre-auth ticket',
  'Member complaint about long call hold times',
  'Arabic translation errors in app UI components',
  'New feature request: add pediatric specialist filter',
  'Chronic condition management reminders not firing',
  'Emergency claim — trauma hospital admission',
  'Integration failure causing Zoho Desk sync errors',
  'App update causing login redirect loop',
  'Claim denial reason unclear in rejection email',
  'Biometric login unavailable on newly enrolled device',
  'Benefit utilization report not generating',
  'Cross-border coverage query for travel abroad',
  'Appointment cancellation not reflected in calendar',
  'Member moved to new plan — data migration error',
  'Ambulance request processing delay reported',
  'End-of-year claims summary not accessible',
  'Network outage affecting online submissions',
  'Premium payment confirmation not received',
]

const MODULES = [
  'Login/Sign Up', 'Login/Sign Up',
  'My Health', 'My Health',
  'Cash Claims', 'Cash Claims',
  'Appointment', 'Appointment',
  'AI Companion',
  'Landing Page (Home)',
  'Call Doctor Now',
  'Wellness',
  'Digital Twin',
  'Apps Sections and Functions', 'Apps Sections and Functions',
  'Language',
]

const REQUEST_TYPES = [
  'Incident', 'Incident', 'Incident',
  'Service Request', 'Service Request',
  'Problem',
  'Change Request',
]

const CASE_TYPES = [
  'Availability', 'Core Function', 'Core Function',
  'Integration', 'Data Integrity',
  'Performance', 'Stability', 'Security',
  'UI / UX', 'Support', 'Support',
  'Access', 'Problem Record', 'Enhancement',
]

const SENTIMENTS = ['positive', 'neutral', 'neutral', 'neutral', 'negative', 'negative', 'negative']
const PRIORITIES  = ['P1', 'P2', 'P2', 'P3', 'P3', 'P3', 'P3', 'P4', 'P4']

const CUSTOMERS = [
  { name: 'Ahmad Al-Farsi',    email: 'ahmad.farsi@medgulf.com.sa' },
  { name: 'Noura Al-Hamdan',   email: 'noura.hamdan@medgulf.com.sa' },
  { name: 'Khalid Mansouri',   email: 'khalid.mansouri@medgulf.com.sa' },
  { name: 'Sara Al-Khatib',    email: 'sara.khatib@medgulf.com.sa' },
  { name: 'Omar Al-Sulaiman',  email: 'omar.sulaiman@medgulf.com.sa' },
  { name: 'Fatima Rahimi',     email: 'fatima.rahimi@medgulf.com.sa' },
  { name: 'Hassan Al-Nouri',   email: 'hassan.nouri@medgulf.com.sa' },
  { name: 'Layla Al-Mansouri', email: 'layla.mansouri@medgulf.com.sa' },
  { name: 'Yusuf Al-Rashid',   email: 'yusuf.rashid@medgulf.com.sa' },
  { name: 'Mariam Khalil',     email: 'mariam.khalil@medgulf.com.sa' },
]

const COACHING_NOTES = [
  'Focus on active listening — agent interrupted customer twice before issue was fully explained.',
  'Good empathy shown but documentation was incomplete at close of call.',
  'Verification steps skipped on this call. Needs refresher on ID check policy.',
  'Resolution quality is improving. Recommend review of pre-auth SOP.',
  'Excellent call — clear communication, thorough documentation, professional close.',
  null,
]

// ─── Step 1: Delete all ClickUp tasks ─────────────────────────────────────────

async function deleteAllClickUpTasks() {
  const token  = process.env.CLICKUP_API_TOKEN
  const listId = process.env.CLICKUP_LIST_ID
  if (!token || !listId) {
    return { deleted: 0, warning: 'CLICKUP_API_TOKEN or CLICKUP_LIST_ID not set — ClickUp cleanup skipped' }
  }

  let totalDeleted = 0
  let page = 0

  while (true) {
    const res = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}/task?page=${page}&limit=100&archived=false&include_closed=true`,
      { headers: { Authorization: token } }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('[reset-seed] ClickUp list fetch failed:', res.status, err)
      break
    }

    const data  = await res.json()
    const tasks = data.tasks || []
    if (tasks.length === 0) break

    // Delete in parallel batches of 10
    for (let i = 0; i < tasks.length; i += 10) {
      await Promise.allSettled(
        tasks.slice(i, i + 10).map(t =>
          fetch(`https://api.clickup.com/api/v2/task/${t.id}`, {
            method: 'DELETE',
            headers: { Authorization: token },
          })
        )
      )
      totalDeleted += Math.min(10, tasks.length - i)
    }

    if (data.last_page) break
    page++
  }

  return { deleted: totalDeleted }
}

// ─── Step 2: Truncate transactional tables ─────────────────────────────────────

async function truncateTables() {
  // Order matters: children before parents (FK-safe)
  const tables = [
    'main.briefing_acks',
    'main.shift_swaps',
    'main.break_requests',
    'main.leave_requests',
    'main.notification_queue',
    'main.notifications',
    'main.sla_alerts',
    'main.processing_logs',
    'main.auth_logs',
    'main.agent_status_history',
    'main.qa_scores',
    'main.call_logs',       // FK to tickets — must precede tickets
    'main.threads',
    'main.tickets',
    'main.shift_rotas',
  ]
  for (const t of tables) {
    await pool.query(`DELETE FROM ${t}`)
  }
  // Reset agent statuses and ensure all active agents have a row
  await pool.query(`
    INSERT INTO main.agent_status (user_id, status, set_at)
    SELECT id, 'available', NOW() FROM main.users WHERE role = 'agent' AND is_active = true
    ON CONFLICT (user_id) DO UPDATE SET status = 'available', set_at = NOW()
  `)
}

// ─── Step 3: Seed 60 tickets ──────────────────────────────────────────────────

async function seedTickets(companyId, solutionId, agents) {
  // Four time buckets: [daysMin, daysMax, count, statuses[]]
  const buckets = [
    {
      daysMin: 0, daysMax: 2, count: 10,
      statuses: ['Open', 'Open', 'In Progress', 'In Progress', 'Pending Customer'],
    },
    {
      daysMin: 3, daysMax: 14, count: 15,
      statuses: ['Open', 'In Progress', 'Resolved', 'Resolved', 'Closed', 'Pending Customer'],
    },
    {
      daysMin: 15, daysMax: 45, count: 20,
      statuses: ['Resolved', 'Resolved', 'Closed', 'Closed', 'In Progress'],
    },
    {
      daysMin: 46, daysMax: 90, count: 15,
      statuses: ['Closed', 'Closed', 'Resolved', 'Resolved'],
    },
  ]

  // channel weights: voice 35%, email 30%, apex 20%, clickup 15%
  const CHANNELS = ['voice', 'voice', 'voice', 'voice', 'email', 'email', 'email', 'apex', 'apex', 'clickup']

  const insertedTickets = []
  const clickupCreated  = []
  let titleIdx = 0

  for (const bucket of buckets) {
    for (let i = 0; i < bucket.count; i++) {
      const daysBack    = randInt(bucket.daysMin === 0 ? 0 : bucket.daysMin, bucket.daysMax)
      const createdAt   = daysAgoTs(daysBack)
      const createdMs   = new Date(createdAt).getTime()
      const priority    = rand(PRIORITIES)
      const status      = rand(bucket.statuses)
      const channel     = rand(CHANNELS)
      const customer    = rand(CUSTOMERS)
      const agent       = agents[i % agents.length]
      const module      = rand(MODULES)
      const requestType = rand(REQUEST_TYPES)
      const caseType    = rand(CASE_TYPES)
      const sentiment   = rand(SENTIMENTS)
      const title       = TICKET_TITLES[titleIdx % TICKET_TITLES.length]
      titleIdx++

      const slaHrs    = priority === 'P1' ? 4 : priority === 'P2' ? 8 : priority === 'P3' ? 24 : 72
      const slaDueAt  = new Date(createdMs + slaHrs * 3600000).toISOString()
      const nowMs     = Date.now()
      const elapsedHrs = (nowMs - createdMs) / 3600000
      const consumed  = Math.min(999.99, Math.round((elapsedHrs / slaHrs) * 10000) / 100)

      const isOpen = !['Resolved', 'Closed'].includes(status)
      let slaStatus
      if (!isOpen) {
        slaStatus = 'resolved'
      } else if (consumed >= 100) {
        slaStatus = 'breached'
      } else if (consumed >= 85) {
        slaStatus = 'critical'
      } else if (consumed >= 65) {
        slaStatus = 'warning'
      } else {
        slaStatus = 'healthy'
      }

      const resolvedAt = ['Resolved', 'Closed'].includes(status)
        ? new Date(createdMs + randInt(3600000, Math.max(3600001, Math.floor(slaHrs * 3600000 * 0.9)))).toISOString()
        : null
      const closedAt = status === 'Closed' ? resolvedAt : null

      const r = await pool.query(
        `INSERT INTO main.tickets (
          company_id, solution_id, title, description, module,
          request_type, case_type, priority, status, channel,
          assigned_to_id, assigned_to_email, assigned_to_name,
          created_by_name, created_by_email,
          ai_sentiment, ai_summary,
          sla_resolution_due, sla_consumption_pct, sla_status,
          escalation_level, is_deleted, created_at, updated_at,
          resolved_at, closed_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,
          $18,$19,$20,0,false,$21,$21,$22,$23
        ) RETURNING id`,
        [
          companyId, solutionId,
          title,
          `Support request: ${title}. Module affected: ${module}. Reported by: ${customer.name}.`,
          module, requestType, caseType, priority, status, channel,
          agent.id, agent.email, agent.full_name,
          customer.name, customer.email,
          sentiment,
          `${requestType} logged for ${module}. Current status: ${status}.`,
          slaDueAt, consumed, slaStatus,
          createdAt, resolvedAt, closedAt,
        ]
      )
      const ticketId = r.rows[0].id

      insertedTickets.push({
        id: ticketId, title, status, channel,
        priority, requestType, caseType, createdAt,
        slaStatus, agentId: agent.id,
      })

      // Push to ClickUp for clickup-channel tickets
      if (channel === 'clickup') {
        try {
          const cu = await createClickUpTask({
            id: ticketId,
            title,
            description: `Support request: ${title}.\nModule: ${module}.\nReported by: ${customer.name} (${customer.email}).`,
            priority,
            status: status.toLowerCase(),
            request_type: requestType,
            case_type: caseType,
            module,
          })
          if (cu) {
            await pool.query(
              `UPDATE main.tickets SET clickup_task_id = $1, clickup_url = $2 WHERE id = $3`,
              [cu.clickup_task_id, cu.clickup_url, ticketId]
            )
            clickupCreated.push(cu.clickup_task_id)
          }
        } catch (e) {
          console.warn('[reset-seed] ClickUp push failed for ticket', ticketId, e.message)
        }
      }

      // Insert initial thread
      await pool.query(
        `INSERT INTO main.threads
          (ticket_id, action_type, actor_name, actor_email, raw_content, ai_summary, thread_source, created_at)
         VALUES ($1,'ticket_created',$2,$3,$4,$5,'system',$6)`,
        [
          ticketId,
          customer.name, customer.email,
          `Support request: ${title}`,
          `${requestType} for ${module} — ${status}`,
          createdAt,
        ]
      )
    }
  }

  return { tickets: insertedTickets, clickupCreated }
}

// ─── Step 4: Seed 80 call logs (last 30 days) ─────────────────────────────────

async function seedCallLogs(agents, tickets) {
  const resolvedVoiceTickets = tickets.filter(
    t => t.channel === 'voice' && ['Resolved', 'Closed'].includes(t.status)
  )
  let inserted = 0

  for (let i = 0; i < 80; i++) {
    const agent    = agents[i % agents.length]
    const daysBack = randInt(0, 30)
    const startedAt = new Date()
    startedAt.setDate(startedAt.getDate() - daysBack)
    startedAt.setHours(randInt(7, 21), randInt(0, 59), randInt(0, 59), 0)

    const isInbound = Math.random() < 0.70
    const isMissed  = isInbound && Math.random() < 0.15

    const duration  = isMissed ? 0 : (isInbound ? randInt(60, 480) : randInt(30, 300))
    const talkTime  = isMissed ? 0 : Math.floor(duration * 0.80)
    const holdTime  = duration - talkTime
    const wrapUp    = isMissed ? 0 : randInt(30, 120)

    const answeredAt = isMissed
      ? null
      : new Date(startedAt.getTime() + randInt(5, 30) * 1000).toISOString()
    const endedAt = isMissed
      ? null
      : new Date(startedAt.getTime() + (duration + wrapUp) * 1000).toISOString()

    let hangupCause = 'NORMAL_CLEARING'
    if (isMissed) hangupCause = Math.random() < 0.5 ? 'NO_ANSWER' : 'ORIGINATOR_CANCEL'

    // Link ~40% of answered inbound calls to a voice ticket
    let ticketId = null
    if (isInbound && !isMissed && Math.random() < 0.40 && resolvedVoiceTickets.length > 0) {
      ticketId = rand(resolvedVoiceTickets).id
    }

    const customerNum = `+9715${randInt(10000000, 99999999)}`
    const callStatus  = isMissed ? 'missed' : 'ended'

    await pool.query(
      `INSERT INTO main.call_logs (
        primary_call_id, agent_id, direction, customer_number,
        duration_secs, talk_time_secs, hold_time_secs,
        hangup_cause, hangup_by, status, ticket_id,
        started_at, answered_at, ended_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (primary_call_id) DO NOTHING`,
      [
        `RS-CALL-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agent.id,
        isInbound ? 'inbound' : 'outbound',
        customerNum,
        duration, talkTime, holdTime,
        hangupCause,
        isMissed ? 'customer' : 'agent',
        callStatus,
        ticketId,
        startedAt.toISOString(), answeredAt, endedAt,
      ]
    )
    inserted++
  }

  return inserted
}

// ─── Step 5a: Seed 20 QA scores ───────────────────────────────────────────────

async function seedQAScores(tickets, agents, adminId) {
  const resolved = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status))
  const toScore  = resolved.slice(0, Math.min(20, resolved.length))

  const PROFILES = ['excellent', 'excellent', 'good', 'good', 'good', 'average', 'average', 'poor']
  const THEMES   = ['active_listening', 'product_knowledge', 'process_adherence', 'documentation', 'escalation_handling']
  let inserted = 0

  for (let i = 0; i < toScore.length; i++) {
    const t       = toScore[i]
    const profile = rand(PROFILES)
    const scores  = generateQAScores(profile)
    const hasCrit = profile === 'poor' && Math.random() < 0.10
    const critFlags = hasCrit ? { misleading_info: true } : {}
    const total   = calcTotal(scores, critFlags)
    const result  = calcResult(total, critFlags)
    const coaching = result !== 'pass' ? rand(COACHING_NOTES) : null
    const themes  = result !== 'pass' ? [rand(THEMES)] : []

    await pool.query(
      `INSERT INTO main.qa_scores (
        ticket_id, agent_id, reviewer_id, company_code,
        scores, critical_flags, coaching_notes, improvement_themes,
        total_score, result, reviewed_at, created_at
      ) VALUES ($1,$2,$3,'medgulf',$4,$5,$6,$7,$8,$9,$10,$10)`,
      [
        t.id,
        t.agentId || agents[0].id,
        adminId,
        JSON.stringify(scores),
        JSON.stringify(critFlags),
        coaching,
        JSON.stringify(themes),
        total,
        result,
        daysAgoTs(randInt(0, 14)),
      ]
    )
    inserted++
  }

  return inserted
}

// ─── Step 5b: Seed agent status history (last 30 days) ────────────────────────

async function seedAgentStatusHistory(agents) {
  // Simulate realistic shift patterns: available → on_call → wrap_up → available → break → repeat
  const CYCLE = ['available', 'on_call', 'wrap_up', 'available', 'break']
  const DURATIONS_MIN = [90, 25, 4, 70, 15]   // min minutes per status
  const DURATIONS_MAX = [150, 90, 8, 120, 30]  // max minutes per status

  let rows = 0

  for (const agent of agents) {
    for (let d = 29; d >= 0; d--) {
      const shiftStart = new Date()
      shiftStart.setDate(shiftStart.getDate() - d)
      shiftStart.setHours(7, 0, 0, 0)

      let cursor    = shiftStart.getTime()
      const shiftEnd = cursor + 7 * 3600000   // 7-hour shift
      let stIdx = 0

      while (cursor < shiftEnd) {
        const statusLabel = CYCLE[stIdx % CYCLE.length]
        const durMs = randInt(DURATIONS_MIN[stIdx % CYCLE.length], DURATIONS_MAX[stIdx % CYCLE.length]) * 60000
        const endMs = Math.min(cursor + durMs, shiftEnd)

        await pool.query(
          `INSERT INTO main.agent_status_history (user_id, status, started_at, ended_at) VALUES ($1,$2,$3,$4)`,
          [agent.id, statusLabel, new Date(cursor).toISOString(), new Date(endMs).toISOString()]
        )
        rows++
        cursor = endMs
        stIdx++
      }
    }
  }

  return rows
}

// ─── Step 5c: Seed shift rotas (last 21 days) ─────────────────────────────────

async function seedShiftRotas(agents, adminId) {
  const SHIFT_CONFIGS = [
    { start: '07:00', end: '15:00', type: 'morning' },
    { start: '09:00', end: '17:00', type: 'regular' },
    { start: '14:00', end: '22:00', type: 'afternoon' },
  ]
  let rows = 0

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]
    const cfg   = SHIFT_CONFIGS[i % SHIFT_CONFIGS.length]

    for (let d = 21; d >= 0; d--) {
      const shiftDate = new Date()
      shiftDate.setDate(shiftDate.getDate() - d)
      const dateStr = shiftDate.toISOString().split('T')[0]

      await pool.query(
        `INSERT INTO main.shift_rotas
          (user_id, shift_date, start_time, end_time, shift_type, agent_type, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,'Inbound',$6,NOW())`,
        [agent.id, dateStr, cfg.start, cfg.end, cfg.type, adminId]
      )
      rows++
    }
  }

  return rows
}

// ─── Step 5d: Seed case_types and kpi_configs (idempotent) ───────────────────

async function seedAdminConfig(solutionId) {
  // Request type IDs (fixed order from setup): Change Request=1, Incident=2, Service Request=3, Problem=4
  // Fetch them dynamically to be safe
  const rtR = await pool.query(
    `SELECT id, request_type FROM main.request_types WHERE solution_id = $1 ORDER BY id`, [solutionId]
  )
  const rtMap = {}
  for (const r of rtR.rows) rtMap[r.request_type] = r.id

  const CASE_TYPE_DEFS = [
    { rt: 'Incident',        case_type: 'Availability',   description: 'Service or feature completely unavailable',        default_priority: 'P1' },
    { rt: 'Incident',        case_type: 'Core Function',  description: 'Core functionality impaired or broken',            default_priority: 'P1' },
    { rt: 'Incident',        case_type: 'Performance',    description: 'Severe performance degradation affecting users',   default_priority: 'P2' },
    { rt: 'Incident',        case_type: 'Stability',      description: 'Application crashes or unexpected restarts',       default_priority: 'P2' },
    { rt: 'Incident',        case_type: 'Data Integrity', description: 'Data corruption, loss or incorrect display',       default_priority: 'P2' },
    { rt: 'Incident',        case_type: 'Security',       description: 'Security vulnerability or unauthorized access',    default_priority: 'P1' },
    { rt: 'Service Request', case_type: 'Support',        description: 'User guidance, how-to, or assistance request',    default_priority: 'P3' },
    { rt: 'Service Request', case_type: 'Access',         description: 'Account access, permission or credential request',default_priority: 'P3' },
    { rt: 'Service Request', case_type: 'UI / UX',        description: 'Interface improvement or display issue request',  default_priority: 'P4' },
    { rt: 'Problem',         case_type: 'Integration',    description: 'Recurring integration or sync failure',           default_priority: 'P2' },
    { rt: 'Problem',         case_type: 'Problem Record', description: 'Root cause investigation for recurring incidents',default_priority: 'P2' },
    { rt: 'Change Request',  case_type: 'Enhancement',    description: 'New feature, enhancement or improvement request', default_priority: 'P4' },
  ]

  let caseTypesInserted = 0
  for (const ct of CASE_TYPE_DEFS) {
    const rtId = rtMap[ct.rt]
    if (!rtId) continue
    const r = await pool.query(
      `INSERT INTO main.case_types (solution_id, request_type_id, case_type, description, default_priority)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING RETURNING id`,
      [solutionId, rtId, ct.case_type, ct.description, ct.default_priority]
    )
    if (r.rows.length) caseTypesInserted++
  }

  // KPI configs — delete and re-insert to keep fresh
  await pool.query(`DELETE FROM main.kpi_configs WHERE solution_id = $1`, [solutionId])
  await pool.query(
    `INSERT INTO main.kpi_configs (solution_id, kpi_code, kpi_name, description, calculation_method, target_value, unit, report_frequency) VALUES
    ($1,'FCR',      'First Call Resolution',   'Percentage of calls resolved on first contact',                    'resolved_calls / total_calls * 100',         80,  '%',  'daily'),
    ($1,'AHT',      'Average Handle Time',     'Mean time from call answer to agent wrap-up',                      'sum(talk+hold+wrap_up) / answered_calls',     240, 'sec','daily'),
    ($1,'CSAT',     'Customer Satisfaction',   'Average satisfaction score from post-call surveys',                'sum(scores) / survey_count',                  4.2, '/5', 'weekly'),
    ($1,'SLA_COMP', 'SLA Compliance Rate',     'Percentage of tickets resolved within SLA',                        'within_sla / total_resolved * 100',           95,  '%',  'daily'),
    ($1,'ABN_RATE', 'Abandonment Rate',        'Percentage of inbound calls abandoned before answer',              'abandoned / (answered + abandoned) * 100',    5,   '%',  'daily'),
    ($1,'OCC',      'Agent Occupancy',         'Percentage of shift time agents are handling calls',               'handling_time / shift_time * 100',            75,  '%',  'weekly'),
    ($1,'ADHR',     'Schedule Adherence',      'Percentage of time agents follow scheduled activities',            'adherent_intervals / total_intervals * 100',  90,  '%',  'weekly'),
    ($1,'MTTR',     'Mean Time to Resolve',    'Average hours from ticket creation to resolution',                 'sum(resolution_hours) / resolved_count',      24,  'hr', 'weekly')`,
    [solutionId]
  )

  return { caseTypesInserted, kpiInserted: 8 }
}

// ─── Step 5e: Seed SLA alerts for breached/critical tickets ──────────────────

async function seedSLAAlerts(adminId) {
  const result = await pool.query(`
    INSERT INTO main.sla_alerts (ticket_id, alert_level, consumption_pct, notified_emails, notification_channel, created_at)
    SELECT
      t.id,
      CASE WHEN t.sla_consumption_pct >= 100 THEN 4
           WHEN t.sla_consumption_pct >= 85  THEN 3
           WHEN t.sla_consumption_pct >= 65  THEN 2
           ELSE 1 END,
      t.sla_consumption_pct,
      ARRAY['ann.shruthy@iohealth.com'],
      'system',
      NOW() - (RANDOM() * INTERVAL '2 hours')
    FROM main.tickets t
    WHERE t.sla_status IN ('breached', 'critical', 'warning')
      AND (t.is_deleted = false OR t.is_deleted IS NULL)
    RETURNING id
  `)
  return result.rows.length
}

// ─── Step 5f: Seed notifications ──────────────────────────────────────────────

async function seedNotifications(tickets, agents, adminId) {
  // Admin: SLA breach notifications (up to 5)
  const breachedTickets = tickets.filter(t => t.slaStatus === 'breached').slice(0, 5)
  for (const t of breachedTickets) {
    await pool.query(
      `INSERT INTO main.notifications (user_id, type, title, body, link, is_read, created_at)
       VALUES ($1,'sla_breach',$2,$3,$4,false,$5)`,
      [
        adminId,
        `SLA Breach: ${t.priority} ticket overdue`,
        `"${t.title}" has breached SLA. Requires immediate action.`,
        `/tickets/${t.id}`,
        daysAgoTs(0),
      ]
    )
  }

  // Admin: system notification
  await pool.query(
    `INSERT INTO main.notifications (user_id, type, title, body, link, is_read, created_at)
     VALUES ($1,'system','Demo data reset complete','60 tickets, 80 call logs and 20 QA reviews have been seeded.','/dashboard',true,NOW())`,
    [adminId]
  )

  // Agents: ticket assigned + shift confirmed
  for (const agent of agents) {
    const agentTickets = tickets.filter(t => t.agentId === agent.id).slice(0, 2)
    for (const t of agentTickets) {
      await pool.query(
        `INSERT INTO main.notifications (user_id, type, title, body, link, is_read, created_at)
         VALUES ($1,'ticket_assigned','New ticket assigned to you',$2,'/my-tickets',false,$3)`,
        [agent.id, `${t.title} (${t.priority}) has been assigned to your queue.`, daysAgoTs(0)]
      )
    }
    await pool.query(
      `INSERT INTO main.notifications (user_id, type, title, body, link, is_read, created_at)
       VALUES ($1,'system','Shift schedule confirmed','Your shift for this week has been confirmed. Check briefing for details.','/briefing',false,NOW() - INTERVAL '2 hours')`,
      [agent.id]
    )
  }

  const countR = await pool.query(`SELECT COUNT(*) n FROM main.notifications`)
  return parseInt(countR.rows[0].n)
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!key || key.trim() !== process.env.AUTH_SECRET?.trim()) {
    return NextResponse.json({ error: 'Unauthorized — pass ?key=AUTH_SECRET' }, { status: 401 })
  }

  try {
    // Load org context
    const coR = await pool.query(
      `SELECT id FROM main.companies WHERE company_code = 'medgulf' LIMIT 1`
    )
    const companyId = coR.rows[0]?.id
    if (!companyId) return NextResponse.json({ error: 'medgulf company not found' }, { status: 400 })

    const solR = await pool.query(
      `SELECT id FROM main.solutions WHERE company_id = $1 LIMIT 1`, [companyId]
    )
    const solutionId = solR.rows[0]?.id
    if (!solutionId) return NextResponse.json({ error: 'solution not found' }, { status: 400 })

    const agentsR = await pool.query(
      `SELECT id, email, full_name FROM main.users WHERE role = 'agent' AND is_active = true ORDER BY id`
    )
    const agents = agentsR.rows
    if (!agents.length) {
      return NextResponse.json(
        { error: 'No active agents found — run /api/seed?key=...&seed=true first' },
        { status: 400 }
      )
    }

    const adminR = await pool.query(
      `SELECT id FROM main.users WHERE role = 'admin' ORDER BY id LIMIT 1`
    )
    const adminId = adminR.rows[0]?.id || agents[0].id

    // ── Step 1 ────────────────────────────────────────────────────────────────
    const clickupResult = await deleteAllClickUpTasks()

    // ── Step 2 ────────────────────────────────────────────────────────────────
    await truncateTables()

    // ── Step 3 ────────────────────────────────────────────────────────────────
    const { tickets, clickupCreated } = await seedTickets(companyId, solutionId, agents)

    // ── Step 4 ────────────────────────────────────────────────────────────────
    const callsSeeded = await seedCallLogs(agents, tickets)

    // ── Step 5 ────────────────────────────────────────────────────────────────
    const qaSeeded            = await seedQAScores(tickets, agents, adminId)
    const statusHistoryRows   = await seedAgentStatusHistory(agents)
    const shiftRotasSeeded    = await seedShiftRotas(agents, adminId)
    const adminConfig         = await seedAdminConfig(solutionId)
    const slaAlertsSeeded     = await seedSLAAlerts(adminId)
    const notificationsSeeded = await seedNotifications(tickets, agents, adminId)

    return NextResponse.json({
      ok: true,
      clickup_deleted:      clickupResult.deleted,
      ...(clickupResult.warning && { clickup_warning: clickupResult.warning }),
      clickup_created:      clickupCreated.length,
      tickets_seeded:       tickets.length,
      calls_seeded:         callsSeeded,
      qa_scores_seeded:     qaSeeded,
      status_history_rows:  statusHistoryRows,
      shift_rotas_seeded:   shiftRotasSeeded,
      case_types_seeded:    adminConfig.caseTypesInserted,
      kpi_configs_seeded:   adminConfig.kpiInserted,
      sla_alerts_seeded:    slaAlertsSeeded,
      notifications_seeded: notificationsSeeded,
    })
  } catch (err) {
    console.error('[reset-seed] Fatal error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
