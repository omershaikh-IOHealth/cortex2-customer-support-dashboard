const pg = require('pg')
const fs = require('fs')

const raw = fs.readFileSync('.env.local', 'utf8')
const env = {}
raw.split('\n').forEach(line => {
  line = line.replace(/\r/, '').trim()
  if (!line || line.startsWith('#')) return
  const idx = line.indexOf('=')
  if (idx < 0) return
  const k = line.substring(0, idx).trim()
  let v = line.substring(idx + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  env[k] = v
})

const pool = new pg.Pool({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '5432'),
  database: env.DB_NAME, user: env.DB_USER,
  password: env.DB_PASSWORD, ssl: { rejectUnauthorized: false }
})

// Actual columns (verified):
// shift_rotas:    id, user_id, shift_date, start_time, end_time, shift_type, notes, created_by, created_at, agent_type
// shift_swaps:    id, requester_id, requester_shift_id, target_agent_id, target_shift_id, target_response, supervisor_response, supervisor_id, supervisor_note, status, created_at, updated_at
// leave_requests: id, user_id, start_date, end_date, leave_type, note, status, reviewed_by, review_note, created_at, updated_at, start_time, end_time
// notifications:  id, user_id, type, title, body, link, is_read, created_at

// Schedule design:
// Shift A (Day):     09:00-17:00 → Asif(2) inbound  + Sarah(5) outbound
// Shift B (Evening): 14:00-22:00 → Mohammed(6) inbound + Fatima(7) inbound
// Shift C (Night):   21:00-06:00 → Khalid(8) inbound only (no outbound at night)
const AGENTS = [
  { id: 2, shift: 'A', start: '09:00', end: '17:00', type: 'regular',  role: 'inbound',  bStart: '13:00', bEnd: '13:30', bType: 'lunch' },
  { id: 5, shift: 'A', start: '09:00', end: '17:00', type: 'regular',  role: 'outbound', bStart: '13:00', bEnd: '13:30', bType: 'lunch' },
  { id: 6, shift: 'B', start: '14:00', end: '22:00', type: 'regular',  role: 'inbound',  bStart: '18:00', bEnd: '18:30', bType: 'lunch' },
  { id: 7, shift: 'B', start: '14:00', end: '22:00', type: 'regular',  role: 'inbound',  bStart: '18:00', bEnd: '18:30', bType: 'lunch' },
  { id: 8, shift: 'C', start: '21:00', end: '06:00', type: 'regular',  role: 'inbound',  bStart: '02:00', bEnd: '02:30', bType: 'scheduled' },
]

// Use local date parts to avoid UTC shift issues
function fmtLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekdayDates(mondayStr) {
  const dates = []
  const [y, mo, da] = mondayStr.split('-').map(Number)
  const base = new Date(y, mo - 1, da) // local midnight, no UTC shift
  for (let i = 0; i < 5; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    dates.push(fmtLocal(d))
  }
  return dates
}

function getWeekendDates(mondayStr) {
  const dates = []
  const [y, mo, da] = mondayStr.split('-').map(Number)
  const base = new Date(y, mo - 1, da)
  for (let i = 5; i < 7; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    dates.push(fmtLocal(d))
  }
  return dates
}

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Clear dependent tables first (FK constraints)
    await client.query("DELETE FROM main.shift_swaps")
    await client.query("DELETE FROM main.shift_rotas WHERE shift_date >= '2026-03-09'")
    console.log('Cleared current/future shifts')

    const weeks = ['2026-03-09', '2026-03-16', '2026-03-23']
    let shiftCount = 0

    for (const weekStart of weeks) {
      const weekdays = getWeekdayDates(weekStart)
      const weekend = getWeekendDates(weekStart)

      // Weekday: all 5 agents on their assigned shifts
      for (const agent of AGENTS) {
        for (const date of weekdays) {
          const r = await client.query(
            `INSERT INTO main.shift_rotas (user_id, shift_date, start_time, end_time, shift_type, agent_type, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [agent.id, date, agent.start, agent.end, agent.type, agent.role, `Shift ${agent.shift} — ${agent.role}`]
          )
          if (r.rows[0]) {
            await client.query(
              'INSERT INTO main.shift_breaks (shift_id, break_start, break_end, break_type) VALUES ($1, $2, $3, $4)',
              [r.rows[0].id, agent.bStart, agent.bEnd, agent.bType]
            )
            shiftCount++
          }
        }
      }

      // Weekend: Asif on-call (inbound only, shorter hours)
      for (const date of weekend) {
        const r = await client.query(
          `INSERT INTO main.shift_rotas (user_id, shift_date, start_time, end_time, shift_type, agent_type, notes)
           VALUES (2, $1, '10:00', '16:00', 'on_call', 'inbound', 'Weekend on-call coverage')
           RETURNING id`,
          [date]
        )
        if (r.rows[0]) {
          await client.query(
            'INSERT INTO main.shift_breaks (shift_id, break_start, break_end, break_type) VALUES ($1, $2, $3, $4)',
            [r.rows[0].id, '13:00', '13:30', 'lunch']
          )
          shiftCount++
        }
      }
    }
    console.log('Inserted shifts:', shiftCount)

    // ── Notifications (body column, no company_code) ───────────────────────
    const adminR = await client.query("SELECT id FROM main.users WHERE role='admin' LIMIT 1")
    const adminId = adminR.rows[0]?.id || 1

    const notifs = [
      { uid: adminId, type: 'sla_breach',  title: 'SLA Breach Warning',    body: 'Ticket #TKT-0042 has exceeded 85% SLA consumption. Immediate action required.',         read: false },
      { uid: adminId, type: 'escalation',  title: 'New Escalation Created', body: 'Ticket #TKT-0037 has been escalated by Mohammed Hassan. Priority: High.',               read: false },
      { uid: adminId, type: 'info',        title: 'QA Review Completed',    body: 'Sarah Al-Rashidi scored 91/100 on QA review for ticket #TKT-0028. Result: Pass.',       read: false },
      { uid: adminId, type: 'warning',     title: 'Agent Status Alert',     body: 'Khalid Ahmed has exceeded scheduled break time by 12 minutes.',                          read: false },
      { uid: adminId, type: 'info',        title: 'Shift Swap Request',     body: 'Mohammed Hassan requested a shift swap with Fatima Al-Zaabi for 2026-03-14.',            read: false },
      { uid: adminId, type: 'success',     title: 'Leave Request Approved', body: 'Annual leave for Sarah Al-Rashidi (Mar 16–17) has been approved.',                      read: true  },
      { uid: adminId, type: 'info',        title: 'Circular Published',     body: 'Circular "Q1 2026 MedGulf Policy Update" published. 3 agents have acknowledged.',       read: true  },
      { uid: adminId, type: 'sla_breach',  title: 'Critical SLA Breach',   body: 'Ticket #TKT-0055 breached SLA (P1). Automatic escalation triggered.',                   read: true  },
      { uid: 2,       type: 'info',        title: 'New Ticket Assigned',    body: 'Ticket #TKT-0061 has been assigned to you by Admin. Priority: Medium.',                  read: false },
      { uid: 5,       type: 'success',     title: 'QA Score Received',      body: 'Your QA review for ticket #TKT-0028 is complete. Score: 91/100 — Pass.',                read: false },
    ]
    for (const n of notifs) {
      await client.query(
        `INSERT INTO main.notifications (user_id, type, title, body, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() - (random() * INTERVAL '3 days'))`,
        [n.uid, n.type, n.title, n.body, n.read]
      )
    }
    console.log('Inserted notifications:', notifs.length)

    // ── Leave Requests (reviewed_by, no company_code) ─────────────────────
    await client.query("DELETE FROM main.leave_requests")
    const leaveReqs = [
      { uid: 5, ltype: 'annual',    s: '2026-03-16', e: '2026-03-17', note: 'Planned vacation',           status: 'approved', rev: adminId },
      { uid: 6, ltype: 'sick',      s: '2026-03-14', e: '2026-03-14', note: 'Doctor appointment',         status: 'approved', rev: adminId },
      { uid: 8, ltype: 'annual',    s: '2026-03-20', e: '2026-03-21', note: 'Family commitment',          status: 'pending',  rev: null },
      { uid: 7, ltype: 'other',     s: '2026-03-25', e: '2026-03-25', note: 'Personal emergency',         status: 'pending',  rev: null },
      { uid: 2, ltype: 'annual',    s: '2026-04-01', e: '2026-04-03', note: 'Eid Al-Fitr extended break', status: 'pending',  rev: null },
    ]
    for (const lr of leaveReqs) {
      await client.query(
        `INSERT INTO main.leave_requests (user_id, leave_type, start_date, end_date, note, status, reviewed_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '2 days')`,
        [lr.uid, lr.ltype, lr.s, lr.e, lr.note, lr.status, lr.rev]
      )
    }
    console.log('Inserted leave requests:', leaveReqs.length)

    // ── Shift Swaps (no company_code, no reason column) ────────────────────
    const mohShift = await client.query("SELECT id FROM main.shift_rotas WHERE user_id=6 AND shift_date='2026-03-11' LIMIT 1")
    const fatShift = await client.query("SELECT id FROM main.shift_rotas WHERE user_id=7 AND shift_date='2026-03-12' LIMIT 1")
    const asifShift = await client.query("SELECT id FROM main.shift_rotas WHERE user_id=2 AND shift_date='2026-03-13' LIMIT 1")
    const sarahShift = await client.query("SELECT id FROM main.shift_rotas WHERE user_id=5 AND shift_date='2026-03-13' LIMIT 1")

    const swaps = []
    if (mohShift.rows[0] && fatShift.rows[0]) {
      swaps.push({ req: 6, reqShift: mohShift.rows[0].id, tgt: 7, tgtShift: fatShift.rows[0].id, tgtResp: 'accepted', status: 'awaiting_supervisor' })
    }
    if (asifShift.rows[0] && sarahShift.rows[0]) {
      swaps.push({ req: 5, reqShift: sarahShift.rows[0].id, tgt: 2, tgtShift: asifShift.rows[0].id, tgtResp: 'accepted', status: 'approved' })
    }

    for (const sw of swaps) {
      try {
        await client.query(
          `INSERT INTO main.shift_swaps (requester_id, requester_shift_id, target_agent_id, target_shift_id, target_response, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 day')`,
          [sw.req, sw.reqShift, sw.tgt, sw.tgtShift, sw.tgtResp, sw.status]
        )
      } catch (e) {
        console.log('Swap insert error:', e.message)
      }
    }
    console.log('Inserted shift swaps:', swaps.length)

    await client.query('COMMIT')
    console.log('ALL DONE!')

    // Final summary
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM main.shift_rotas WHERE shift_date >= '2026-03-09') as rotas,
        (SELECT COUNT(*) FROM main.notifications) as notifications,
        (SELECT COUNT(*) FROM main.leave_requests) as leave_requests,
        (SELECT COUNT(*) FROM main.shift_swaps) as shift_swaps
    `)
    console.log('Final counts:', counts.rows[0])

  } catch (e) {
    await client.query('ROLLBACK')
    console.error('ERROR:', e.message)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
