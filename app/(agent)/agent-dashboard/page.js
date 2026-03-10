'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  Phone, PhoneIncoming, PhoneOutgoing, Clock, Target, RefreshCw,
  Coffee, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus,
  CheckCircle, AlertTriangle, XCircle, BarChart2, Shield, Activity,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { getAgentDashboardMetrics, getSystemSettings, syncMyCalls } from '@/lib/api'

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtSecs(secs) {
  if (!secs) return '0:00'
  const m = Math.floor(secs / 60)
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
function fmtSecsLong(secs) {
  if (!secs && secs !== 0) return '—'
  const m = Math.floor(secs / 60)
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}m ${s}s`
}
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
function startOfWeek(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - day)
  return toDateStr(d)
}
function startOfMonth(dateStr) {
  const d = new Date(dateStr)
  d.setDate(1)
  return toDateStr(d)
}
function endOfMonth(dateStr) {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + 1, 0)
  return toDateStr(d)
}
function fmtDisplayRange(view, from, to) {
  if (view === 'day') {
    return new Date(from).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (view === 'week') {
    const f = new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const t = new Date(to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${f} – ${t}`
  }
  return new Date(from).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// ── sub-components ────────────────────────────────────────────────────────────
function KPITile({ label, value, target, unit = '', color, trend, targetLabel }) {
  const statusColors = {
    good: 'text-cortex-success',
    warn: 'text-cortex-warning',
    bad: 'text-cortex-danger',
    neutral: 'text-cortex-muted',
  }
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  return (
    <div className="card flex flex-col gap-1 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-cortex-muted truncate">{label}</p>
      <div className={`text-2xl font-display font-bold leading-none ${statusColors[color] || 'text-cortex-text'}`}>
        {value}{unit}
      </div>
      {target != null && (
        <p className="text-[10px] text-cortex-muted">Target: {target}{unit} {targetLabel || ''}</p>
      )}
      {trend && (
        <TrendIcon className={`w-3 h-3 ${statusColors[color] || 'text-cortex-muted'}`} />
      )}
    </div>
  )
}

function TargetBar({ label, actual, target, unit = '', lowerIsBetter = false, suffix = '' }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
  const isGood = lowerIsBetter ? actual <= target : actual >= target
  const isWarn = lowerIsBetter ? actual <= target * 1.2 : actual >= target * 0.8
  const barColor = isGood ? 'bg-cortex-success' : isWarn ? 'bg-cortex-warning' : 'bg-cortex-danger'
  const statusLabel = isGood ? 'On Track' : isWarn ? 'At Risk' : 'Below Target'
  const statusColor = isGood ? 'text-cortex-success bg-cortex-success/10' : isWarn ? 'text-cortex-warning bg-cortex-warning/10' : 'text-cortex-danger bg-cortex-danger/10'

  const displayActual = actual != null ? `${actual}${suffix}` : '—'
  const displayTarget = target != null ? `${target}${suffix}` : '—'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-cortex-text">{label}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>{actual != null ? statusLabel : 'No data'}</span>
      </div>
      <div className="h-2 rounded-full bg-cortex-bg overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-cortex-muted">
        <span>{displayActual}</span>
        <span>Target: {displayTarget}</span>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function AgentDashboardPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  // Date range navigation
  const [view, setView] = useState('day') // 'day' | 'week' | 'month'
  const [anchorDate, setAnchorDate] = useState(toDateStr(new Date()))

  const { dateFrom, dateTo } = useMemo(() => {
    if (view === 'day') return { dateFrom: anchorDate, dateTo: anchorDate }
    if (view === 'week') {
      const from = startOfWeek(anchorDate)
      const to = addDays(from, 6)
      return { dateFrom: from, dateTo: to }
    }
    return { dateFrom: startOfMonth(anchorDate), dateTo: endOfMonth(anchorDate) }
  }, [view, anchorDate])

  function navigatePrev() {
    if (view === 'day') setAnchorDate(d => addDays(d, -1))
    else if (view === 'week') setAnchorDate(d => addDays(startOfWeek(d), -7))
    else {
      const d = new Date(anchorDate)
      d.setMonth(d.getMonth() - 1)
      setAnchorDate(toDateStr(d))
    }
  }
  function navigateNext() {
    if (view === 'day') setAnchorDate(d => addDays(d, 1))
    else if (view === 'week') setAnchorDate(d => addDays(startOfWeek(d), 7))
    else {
      const d = new Date(anchorDate)
      d.setMonth(d.getMonth() + 1)
      setAnchorDate(toDateStr(d))
    }
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const r = await syncMyCalls()
      setSyncMsg({ ok: true, text: `Synced ${r.synced} · ${r.skipped} already existed` })
      qc.invalidateQueries({ queryKey: ['agent-metrics'] })
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['agent-metrics', dateFrom, dateTo],
    queryFn: () => getAgentDashboardMetrics({ date_from: dateFrom, date_to: dateTo }),
    refetchInterval: 60000,
  })

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: getSystemSettings,
    staleTime: 300000,
  })

  const targets = {
    calls: parseInt(settings?.agent_target_calls_per_day) || 120,
    aht: parseInt(settings?.agent_target_aht_seconds) || 135,
    maxMissed: parseInt(settings?.agent_target_max_missed) || 3,
    fcr: parseInt(settings?.agent_target_fcr_pct) || 80,
    wrapup: parseInt(settings?.agent_target_wrapup_seconds) || 60,
  }

  const todayStr = toDateStr(new Date())
  const { data: todayShift } = useQuery({
    queryKey: ['today-shift', todayStr],
    queryFn: () => fetch(`/api/rota?from=${todayStr}&to=${todayStr}`).then(r => r.ok ? r.json() : []).then(s => s[0] || null),
    staleTime: 300000,
  })

  // Live shift progress
  const shiftProgress = useMemo(() => {
    if (!todayShift) return null
    const now = new Date()
    const [sh, sm] = todayShift.start_time.split(':').map(Number)
    const [eh, em] = todayShift.end_time.split(':').map(Number)
    const start = new Date(now); start.setHours(sh, sm, 0, 0)
    const end = new Date(now); end.setHours(eh, em, 0, 0)
    const total = (end - start) / 1000 / 60 // minutes
    const elapsed = Math.max(0, Math.min(total, (now - start) / 1000 / 60))
    const remaining = Math.max(0, total - elapsed)
    const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0
    return { pct, remaining: Math.round(remaining), total: Math.round(total) }
  }, [todayShift])

  // Color helpers for KPI tiles
  function callsColor(v) { return v >= targets.calls ? 'good' : v >= targets.calls * 0.8 ? 'warn' : 'bad' }
  function ahtColor(v) { return v <= targets.aht ? 'good' : v <= targets.aht * 1.2 ? 'warn' : 'bad' }
  function missedColor(v) { return v <= targets.maxMissed ? 'good' : v <= targets.maxMissed * 1.5 ? 'warn' : 'bad' }
  function fcrColor(v) { return v >= targets.fcr ? 'good' : v >= targets.fcr * 0.8 ? 'warn' : 'bad' }
  function adherenceColor(v) { return v == null ? 'neutral' : v >= 85 ? 'good' : v >= 70 ? 'warn' : 'bad' }
  function occupancyColor(v) { return v == null ? 'neutral' : v >= 70 && v <= 90 ? 'good' : 'warn' }

  const m = metrics || {}

  // Filter calls_by_hour to business hours (8-20) for cleaner chart
  const hourlyData = (m.calls_by_hour || []).filter(h => h.hour >= 7 && h.hour <= 21)

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Performance Overview</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">My Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && (
            <p className={`text-xs font-mono ${syncMsg.ok ? 'text-cortex-success' : 'text-cortex-danger'}`}>
              {syncMsg.text}
            </p>
          )}
          <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync ZIWO'}
          </button>
        </div>
      </div>

      {/* ── Date navigation ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border border-cortex-border text-xs">
          {['day', 'week', 'month'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 capitalize transition-colors ${view === v ? 'bg-cortex-accent text-white' : 'text-cortex-muted hover:text-cortex-text'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={navigatePrev} className="p-1 rounded-lg hover:bg-cortex-surface-raised text-cortex-muted hover:text-cortex-text transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-cortex-text font-medium min-w-[200px] text-center">
            {fmtDisplayRange(view, dateFrom, dateTo)}
          </span>
          <button onClick={navigateNext} className="p-1 rounded-lg hover:bg-cortex-surface-raised text-cortex-muted hover:text-cortex-text transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {anchorDate !== toDateStr(new Date()) && (
            <button
              onClick={() => setAnchorDate(toDateStr(new Date()))}
              className="text-[10px] px-2 py-1 rounded-lg bg-cortex-accent/10 text-cortex-accent hover:bg-cortex-accent/20 transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* ── 12-tile KPI banner ── */}
      {metricsLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-cortex-bg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <KPITile label="Total Calls" value={m.total_calls ?? 0} color={callsColor(m.total_calls)} target={targets.calls} targetLabel="today" />
          <KPITile label="Inbound Answered" value={m.inbound_answered ?? 0} color={m.inbound_answered > 0 ? 'good' : 'neutral'} />
          <KPITile label="Missed Calls" value={m.missed_calls ?? 0} color={missedColor(m.missed_calls)} target={targets.maxMissed} targetLabel="max" />
          <KPITile label="AHT" value={m.aht_seconds ? fmtSecs(m.aht_seconds) : '—'} color={m.aht_seconds ? ahtColor(m.aht_seconds) : 'neutral'} target={fmtSecs(targets.aht)} />
          <KPITile label="FCR Rate" value={m.fcr_rate != null ? m.fcr_rate : '—'} unit={m.fcr_rate != null ? '%' : ''} color={m.fcr_rate != null ? fcrColor(m.fcr_rate) : 'neutral'} target={targets.fcr} unit="%" />
          <KPITile label="Adherence" value={m.adherence_rate != null ? m.adherence_rate : '—'} unit={m.adherence_rate != null ? '%' : ''} color={adherenceColor(m.adherence_rate)} target={90} unit="%" />
          <KPITile label="Occupancy" value={m.occupancy_rate != null ? m.occupancy_rate : '—'} unit={m.occupancy_rate != null ? '%' : ''} color={occupancyColor(m.occupancy_rate)} />
          <KPITile label="QA Score" value={m.qa_score_avg != null ? m.qa_score_avg : '—'} unit={m.qa_score_avg != null ? '%' : ''} color={m.qa_score_avg >= 85 ? 'good' : m.qa_score_avg >= 70 ? 'warn' : m.qa_score_avg ? 'bad' : 'neutral'} />
          <KPITile label="Wrap-up Avg" value={m.wrap_up_avg_secs ? fmtSecs(m.wrap_up_avg_secs) : '—'} color={m.wrap_up_avg_secs ? (m.wrap_up_avg_secs <= targets.wrapup ? 'good' : 'warn') : 'neutral'} target={fmtSecs(targets.wrapup)} />
          <KPITile label="Tickets Created" value={m.tickets_created ?? 0} color="neutral" />
          <KPITile label="Tickets Closed" value={m.tickets_closed ?? 0} color={m.tickets_closed > 0 ? 'good' : 'neutral'} />
          <KPITile label="Abandoned %" value={m.abandoned_pct != null ? m.abandoned_pct : '—'} unit={m.abandoned_pct != null ? '%' : ''} color={m.abandoned_pct <= 5 ? 'good' : m.abandoned_pct <= 10 ? 'warn' : 'bad'} />
        </div>
      )}

      {/* ── Targets + Live Shift ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Today's Targets (2/3) */}
        <div className="lg:col-span-2 card space-y-4">
          <h2 className="font-semibold text-cortex-text text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-cortex-accent" /> Today's Targets
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <TargetBar label="Calls Handled" actual={m.inbound_answered} target={targets.calls} />
            <TargetBar label="Avg Handle Time" actual={m.aht_seconds} target={targets.aht} unit="s" lowerIsBetter suffix="s" />
            <TargetBar label="Missed Calls (max)" actual={m.missed_calls} target={targets.maxMissed} lowerIsBetter suffix="" />
            <TargetBar label="FCR Rate" actual={m.fcr_rate} target={targets.fcr} suffix="%" />
            <TargetBar label="Adherence" actual={m.adherence_rate} target={90} suffix="%" />
            <TargetBar label="Wrap-up Time" actual={m.wrap_up_avg_secs} target={targets.wrapup} unit="s" lowerIsBetter suffix="s" />
          </div>
        </div>

        {/* Live Shift Widget (1/3) */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-cortex-text text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-cortex-accent" /> Live Shift
          </h2>
          {todayShift ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-center">
                {[
                  { label: 'Shift Start', value: todayShift.start_time?.slice(0, 5) || '—' },
                  { label: 'Shift End', value: todayShift.end_time?.slice(0, 5) || '—' },
                  { label: 'Break', value: todayShift.breaks?.[0] ? `${todayShift.breaks[0].break_start?.slice(0,5)}–${todayShift.breaks[0].break_end?.slice(0,5)}` : 'None' },
                  { label: 'Remaining', value: shiftProgress ? `${shiftProgress.remaining}m` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-cortex-bg px-2 py-2">
                    <p className="text-[10px] text-cortex-muted uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-mono font-semibold text-cortex-text mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {shiftProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-cortex-muted">
                    <span>Shift progress</span>
                    <span>{shiftProgress.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-cortex-bg overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cortex-accent to-cortex-success transition-all"
                      style={{ width: `${shiftProgress.pct}%` }}
                    />
                  </div>
                </div>
              )}
              {todayShift.agent_type && (
                <div className="text-center">
                  <span className="badge bg-cortex-accent/10 text-cortex-accent capitalize text-xs">
                    {todayShift.agent_type}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-cortex-muted text-center py-4">No shift scheduled today</p>
          )}
        </div>
      </div>

      {/* ── Calls by Hour chart ── */}
      <div className="card">
        <h2 className="font-semibold text-cortex-text text-sm flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-cortex-accent" /> Calls by Hour
        </h2>
        {hourlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: 'var(--color-muted, #6b7280)' }}
                tickFormatter={h => `${h}:00`}
                interval={1}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted, #6b7280)' }} />
              <Tooltip
                formatter={(val, name) => [val, name === 'total' ? 'Total Landed' : 'Answered']}
                labelFormatter={h => `${h}:00`}
                contentStyle={{ background: 'var(--cortex-surface, #1f2937)', border: '1px solid var(--cortex-border, #374151)', borderRadius: '8px', fontSize: '11px' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total" name="Total Landed" fill="rgba(96, 165, 250, 0.3)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="answered" name="Answered" fill="rgb(96, 165, 250)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-cortex-muted text-center py-8">No call data for this period</p>
        )}
      </div>

      {/* ── Performance Scorecard ── */}
      <div className="card">
        <h2 className="font-semibold text-cortex-text text-sm flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-cortex-accent" /> Performance Scorecard
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Calls', actual: m.inbound_answered, target: targets.calls, lowerIsBetter: false },
            { label: 'AHT', actual: m.aht_seconds, target: targets.aht, lowerIsBetter: true, fmt: v => fmtSecs(v) },
            { label: 'Missed', actual: m.missed_calls, target: targets.maxMissed, lowerIsBetter: true },
            { label: 'FCR', actual: m.fcr_rate, target: targets.fcr, suffix: '%' },
            { label: 'Adherence', actual: m.adherence_rate, target: 90, suffix: '%' },
            { label: 'QA Score', actual: m.qa_score_avg, target: 85, suffix: '%' },
          ].map(({ label, actual, target, lowerIsBetter, fmt, suffix = '' }) => {
            const isGood = actual == null ? null : lowerIsBetter ? actual <= target : actual >= target
            const display = actual == null ? '—' : fmt ? fmt(actual) : `${actual}${suffix}`
            const Icon = isGood === null ? Minus : isGood ? CheckCircle : AlertTriangle
            const col = isGood === null ? 'text-cortex-muted' : isGood ? 'text-cortex-success' : 'text-cortex-warning'
            return (
              <div key={label} className="rounded-xl bg-cortex-bg p-3 text-center space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-cortex-muted">{label}</p>
                <p className="text-xl font-display font-bold text-cortex-text">{display}</p>
                <div className={`flex items-center justify-center gap-1 ${col}`}>
                  <Icon className="w-3 h-3" />
                  <span className="text-[10px] font-medium">{isGood === null ? 'No data' : isGood ? 'Pass' : 'Review'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Recent Call Summary ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-cortex-text text-sm flex items-center gap-2">
            <Phone className="w-4 h-4 text-cortex-accent" /> Recent Calls
          </h2>
          <Link href="/calls" className="flex items-center gap-1 text-xs text-cortex-accent hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {m.recent_calls?.length > 0 ? (
          <div className="space-y-1.5">
            {m.recent_calls.map(c => {
              const isMissed = c.hangup_cause === 'missed' || (!c.duration_secs)
              const d = c.started_at ? new Date(c.started_at) : null
              return (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-cortex-bg transition-colors">
                  <span className={`badge text-[10px] flex-shrink-0 ${
                    isMissed ? 'text-cortex-danger bg-cortex-danger/10'
                    : c.direction === 'inbound' ? 'text-cortex-success bg-cortex-success/10'
                    : 'text-cortex-warning bg-cortex-warning/10'
                  }`}>
                    {isMissed ? '✗ Missed' : c.direction === 'inbound' ? '↓ In' : '↑ Out'}
                  </span>
                  <span className="text-xs font-mono text-cortex-muted flex-shrink-0">{c.customer_number || '—'}</span>
                  <span className="text-xs text-cortex-text truncate flex-1">{c.customer_name || '—'}</span>
                  <span className="text-xs font-mono text-cortex-muted flex-shrink-0">{fmtSecs(c.duration_secs)}</span>
                  {c.fcr && <span className="badge bg-cortex-success/10 text-cortex-success text-[10px] flex-shrink-0">FCR</span>}
                  <span className="text-[10px] text-cortex-muted flex-shrink-0">{d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-cortex-muted text-center py-4">No calls in this period</p>
        )}
      </div>
    </div>
  )
}
