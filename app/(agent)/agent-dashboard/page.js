'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, BarChart2, Target, RefreshCw, Coffee } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getCalls, getAHTMetrics, getFCRMetrics, syncMyCalls } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'
import NewBadge from '@/components/ui/NewBadge'

function MetricTile({ label, value, sub, icon: Icon, color = 'text-cortex-accent', bg = 'bg-cortex-accent/10' }) {
  return (
    <div className="card flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className={`text-3xl font-display font-bold ${color} leading-none`}>{value}</p>
        <p className="text-xs font-semibold uppercase tracking-wider text-cortex-muted mt-1">{label}</p>
        {sub && <p className="text-xs text-cortex-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function AgentDashboardPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [dirFilter, setDirFilter] = useState('')
  const [custSearch, setCustSearch] = useState('')

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const r = await syncMyCalls()
      setSyncMsg({ ok: true, text: `Synced ${r.synced} · ${r.skipped} already existed` })
      qc.invalidateQueries({ queryKey: ['my-calls'] })
      qc.invalidateQueries({ queryKey: ['aht-metrics'] })
      qc.invalidateQueries({ queryKey: ['fcr-metrics'] })
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['my-calls'],
    queryFn: () => getCalls({ limit: 50 }),
    refetchInterval: 30000,
  })

  const { data: ahtData } = useQuery({
    queryKey: ['aht-metrics'],
    queryFn: getAHTMetrics,
    refetchInterval: 300000,
  })

  const { data: fcrData } = useQuery({
    queryKey: ['fcr-metrics'],
    queryFn: getFCRMetrics,
    refetchInterval: 300000,
  })

  const total     = calls.length
  const inbound   = calls.filter(c => c.direction === 'inbound').length
  const outbound  = calls.filter(c => c.direction === 'outbound').length
  const answered  = calls.filter(c => c.hangup_cause !== 'missed' && c.duration_secs > 0).length
  const avgDuration = total > 0
    ? Math.round(calls.reduce((s, c) => s + (c.duration_secs || 0), 0) / total)
    : 0

  const today = new Date().toDateString()
  const todayCalls = calls.filter(c => new Date(c.started_at).toDateString() === today)

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()

  const { data: todayShift } = useQuery({
    queryKey: ['today-shift', todayStr],
    queryFn: () => fetch(`/api/rota?from=${todayStr}&to=${todayStr}`).then(r => r.ok ? r.json() : []).then(s => s[0] || null),
    staleTime: 300000,
  })

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Overview</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">My Dashboard</h1>
        </div>
        <div className="flex items-center gap-3 pb-1">
          {syncMsg && (
            <p className={`text-xs font-mono ${syncMsg.ok ? 'text-cortex-success' : 'text-cortex-danger'}`}>
              {syncMsg.text}
            </p>
          )}
          <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from ZIWO'}
          </button>
          <NewBadge description="New — pulls your call history from ZIWO into Cortex. Run this once to backfill your call log and populate your AHT & FCR metrics." />
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Total Calls"
          value={total}
          sub={`${todayCalls.length} today`}
          icon={Phone}
          color="text-cortex-accent"
          bg="bg-cortex-accent/10"
        />
        <MetricTile
          label="Inbound"
          value={inbound}
          sub={`${total ? Math.round((inbound / total) * 100) : 0}% of total`}
          icon={PhoneIncoming}
          color="text-cortex-success"
          bg="bg-cortex-success/10"
        />
        <MetricTile
          label="Outbound"
          value={outbound}
          sub={`${total ? Math.round((outbound / total) * 100) : 0}% of total`}
          icon={PhoneOutgoing}
          color="text-cortex-warning"
          bg="bg-cortex-warning/10"
        />
        <MetricTile
          label="Avg Handle Time"
          value={fmtSecs(avgDuration)}
          sub={`${answered} answered`}
          icon={Clock}
          color="text-cortex-text"
          bg="bg-cortex-surface-raised"
        />
        <div className="relative">
          <MetricTile
            label="Daily AHT"
            value={ahtData?.daily_seconds ? fmtSecsLong(ahtData.daily_seconds) : '—:—:—'}
            sub="Today's avg · resets daily"
            icon={Clock}
            color="text-cortex-accent"
            bg="bg-cortex-accent/10"
          />
          <div className="absolute top-3 right-3">
            <NewBadge description="New KPI — your average call handle time for today only. Resets at midnight." />
          </div>
        </div>
        <div className="relative">
          <MetricTile
            label="Monthly AHT"
            value={ahtData?.monthly_seconds ? fmtSecsShort(ahtData.monthly_seconds) : '—:—'}
            sub="30-day avg talk time"
            icon={Clock}
            color="text-cortex-text"
            bg="bg-cortex-surface-raised"
          />
          <div className="absolute top-3 right-3">
            <NewBadge description="New KPI — your average call handle time over the last 30 days. Sync from ZIWO first to populate this." />
          </div>
        </div>
        <div className="relative">
          <MetricTile
            label="FCR Rate (30d)"
            value={fcrData?.fcr_rate != null ? `${fcrData.fcr_rate}%` : '—%'}
            sub="No-ticket calls"
            icon={Target}
            color={fcrData?.fcr_rate >= 70 ? 'text-cortex-success' : fcrData?.fcr_rate >= 50 ? 'text-cortex-warning' : 'text-cortex-danger'}
            bg={fcrData?.fcr_rate >= 70 ? 'bg-cortex-success/10' : fcrData?.fcr_rate >= 50 ? 'bg-cortex-warning/10' : 'bg-cortex-danger/10'}
          />
          <div className="absolute top-3 right-3">
            <NewBadge description="New KPI — your First Call Resolution Rate. Calls you handled without creating a ticket count as resolved on first contact." />
          </div>
        </div>
      </div>

      {/* Today's Shift (Item 23) */}
      {todayShift && (
        <div className="card">
          <h2 className="font-semibold text-cortex-text mb-3 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-cortex-accent" />
            Today's Shift
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge bg-cortex-accent/10 text-cortex-accent font-mono text-sm">
              {todayShift.start_time?.slice(0,5)} – {todayShift.end_time?.slice(0,5)}
            </span>
            {todayShift.shift_type && todayShift.shift_type !== 'regular' && (
              <span className={`badge capitalize ${todayShift.shift_type === 'overtime' ? 'bg-cortex-warning/15 text-cortex-warning' : 'bg-purple-400/15 text-purple-400'}`}>
                {todayShift.shift_type}
              </span>
            )}
            {todayShift.agent_type && (
              <span className="badge bg-cortex-surface-raised text-cortex-text capitalize">{todayShift.agent_type}</span>
            )}
            {todayShift.breaks?.length > 0 && todayShift.breaks.map((b, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-cortex-warning">
                <Coffee className="w-3 h-3" />
                <span className="font-mono">{b.break_start?.slice(0,5)}–{b.break_end?.slice(0,5)}</span>
              </span>
            ))}
            {todayShift.notes && (
              <span className="text-xs text-cortex-muted">{todayShift.notes}</span>
            )}
          </div>
        </div>
      )}

      {/* Recent call log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-cortex-text flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-cortex-accent" />
            Recent Calls
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dirFilter}
              onChange={e => setDirFilter(e.target.value)}
              className="input text-xs py-1.5 w-32"
            >
              <option value="">All directions</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
            <input
              type="text"
              value={custSearch}
              onChange={e => setCustSearch(e.target.value)}
              placeholder="Search customer…"
              className="input text-xs py-1.5 w-40"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 rounded-xl bg-cortex-bg animate-pulse" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <EmptyState icon={Phone} title="No calls logged yet" message="Your recent call history will appear here." />
        ) : (() => {
          const filtered = calls.filter(c => {
            if (dirFilter && c.direction !== dirFilter) return false
            if (custSearch.trim()) {
              const s = custSearch.toLowerCase()
              return (c.resolved_customer_name || c.customer_number || '').toLowerCase().includes(s)
            }
            return true
          })
          return (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cortex-border">
                    <th className="table-header">Direction</th>
                    <th className="table-header">Number</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Duration</th>
                    <th className="table-header">Disposition</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cortex-border">
                  {filtered.slice(0, 20).map(c => {
                    const isMissed = c.hangup_cause === 'missed' || (!c.answered_at && !c.duration_secs)
                    const d = c.started_at ? new Date(c.started_at) : null
                    return (
                      <tr key={c.id} className={`hover:bg-cortex-surface-raised transition-colors ${isMissed ? 'bg-cortex-danger/5' : ''}`}>
                        <td className="table-cell">
                          <span className={`badge text-xs ${
                            isMissed
                              ? 'text-cortex-danger bg-cortex-danger/10'
                              : c.direction === 'inbound'
                                ? 'text-cortex-success bg-cortex-success/10'
                                : 'text-cortex-warning bg-cortex-warning/10'
                          }`}>
                            {c.direction === 'inbound' ? '↓' : '↑'} {isMissed ? 'missed' : c.direction}
                          </span>
                        </td>
                        <td className={`table-cell font-mono text-xs ${isMissed ? 'text-cortex-danger/70' : 'text-cortex-muted'}`}>{c.customer_number || '—'}</td>
                        <td className="table-cell text-xs text-cortex-text max-w-[120px] truncate">{c.resolved_customer_name || '—'}</td>
                        <td className="table-cell font-mono text-sm">{fmtSecs(c.duration_secs)}</td>
                        <td className="table-cell text-xs text-cortex-muted">{c.disposition_name || '—'}</td>
                        <td className="table-cell text-xs text-cortex-muted font-mono">{d ? d.toLocaleDateString('en-GB') : '—'}</td>
                        <td className="table-cell text-xs text-cortex-muted font-mono">{d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

function fmtSecs(secs) {
  if (!secs) return '0:00'
  const m = Math.floor(secs / 60)
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// HH:MM:SS — for daily AHT
function fmtSecsLong(secs) {
  if (!secs) return '0:00:00'
  const h = Math.floor(secs / 3600).toString().padStart(2, '0')
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

// HH:MM — for monthly AHT
function fmtSecsShort(secs) {
  if (!secs) return '0:00'
  const h = Math.floor(secs / 3600).toString().padStart(2, '0')
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  return `${h}:${m}`
}
