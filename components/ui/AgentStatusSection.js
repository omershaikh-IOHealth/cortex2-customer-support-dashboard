'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Phone, Coffee, AlertTriangle, Wifi, WifiOff, Umbrella, Activity, ChevronDown, ChevronRight } from 'lucide-react'
import { getUsers } from '@/lib/api'

const STATUS_CONFIG = {
  available: { label: 'Available',  color: 'text-cortex-success', dot: 'bg-cortex-success',  icon: Wifi },
  busy:      { label: 'On Call',    color: 'text-cortex-warning', dot: 'bg-cortex-warning',  icon: Phone },
  break:     { label: 'On Break',   color: 'text-blue-400',       dot: 'bg-blue-400',        icon: Coffee },
  meeting:   { label: 'Meeting',    color: 'text-purple-400',     dot: 'bg-purple-400',      icon: Users },
  not_ready: { label: 'Not Ready',  color: 'text-cortex-danger',  dot: 'bg-cortex-danger',   icon: AlertTriangle },
  wrap_up:   { label: 'Wrap Up',    color: 'text-orange-400',     dot: 'bg-orange-400',      icon: Activity },
  on_leave:  { label: 'On Leave',   color: 'text-indigo-400',     dot: 'bg-indigo-400',      icon: Umbrella },
  offline:   { label: 'Offline',    color: 'text-cortex-muted',   dot: 'bg-cortex-muted',    icon: WifiOff },
}

const BREAK_LIMIT_MINS = 30

export default function AgentStatusSection() {
  const [statusFilter, setStatusFilter] = useState(null)   // null = show all statuses
  const [showAllAgents, setShowAllAgents] = useState(false) // false = current-shift only
  const [expandedAgent, setExpandedAgent] = useState(null)  // agent id with open timeline

  const { data: allAgents = [], isLoading } = useQuery({
    queryKey: ['admin-agent-status'],
    queryFn: () => getUsers().then(users => users.filter(u => u.role === 'agent')),
    refetchInterval: 30000,
  })

  // Filter to current-shift or on-leave agents unless showAllAgents
  const shiftAgents = showAllAgents
    ? allAgents
    : allAgents.filter(a => a.is_on_shift || a.has_leave_today)

  // Compute effective status (on_leave overrides agent_status)
  function effectiveStatus(a) {
    if (a.has_leave_today) return 'on_leave'
    return a.agent_status || 'offline'
  }

  // Apply status filter
  const displayAgents = statusFilter
    ? shiftAgents.filter(a => effectiveStatus(a) === statusFilter)
    : shiftAgents

  // Count per status (from shiftAgents, not allAgents, for accurate badge counts)
  const statusCounts = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map(s => [s, shiftAgents.filter(a => effectiveStatus(a) === s).length])
  )

  const onlineCount = shiftAgents.filter(a => effectiveStatus(a) !== 'offline' && !a.has_leave_today).length

  function toggleStatusFilter(key) {
    setStatusFilter(prev => prev === key ? null : key)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cortex-accent/10 rounded-lg">
            <Users className="w-5 h-5 text-cortex-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-cortex-text">Agent Status Viewer</h2>
            <p className="text-xs text-cortex-muted">
              {onlineCount} active · {shiftAgents.length} on shift · auto-refreshes every 30s
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowAllAgents(v => !v); setStatusFilter(null) }}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showAllAgents
              ? 'bg-cortex-accent text-white border-cortex-accent'
              : 'border-cortex-border text-cortex-muted hover:border-cortex-accent hover:text-cortex-accent'
          }`}
        >
          {showAllAgents ? 'Showing All Agents' : 'Show All Agents'}
        </button>
      </div>

      {/* Status badges — clickable filters */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = statusCounts[key] || 0
          if (count === 0 && !showAllAgents) return null
          const active = statusFilter === key
          return (
            <button
              key={key}
              onClick={() => toggleStatusFilter(key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs transition-colors ${
                active
                  ? 'bg-cortex-accent/10 border-cortex-accent'
                  : 'bg-cortex-surface border-cortex-border hover:border-cortex-accent/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="text-cortex-muted">{cfg.label}</span>
              <span className={`font-bold ${active ? 'text-cortex-accent' : 'text-cortex-text'}`}>{count}</span>
            </button>
          )
        })}
        {statusFilter && (
          <button
            onClick={() => setStatusFilter(null)}
            className="text-xs px-3 py-2 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-text transition-colors"
          >
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* Agent table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-cortex-surface animate-pulse rounded-lg" />)}</div>
      ) : displayAgents.length === 0 ? (
        <div className="card text-center py-8 text-cortex-muted text-sm">
          {statusFilter ? `No agents with status "${STATUS_CONFIG[statusFilter]?.label}".` : 'No agents currently on shift.'}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header w-6"></th>
                <th className="table-header">Agent</th>
                <th className="table-header">Shift</th>
                <th className="table-header">Status</th>
                <th className="table-header">Since</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Note</th>
              </tr>
            </thead>
            <tbody>
              {displayAgents.map(agent => (
                <AgentStatusRow
                  key={agent.id}
                  agent={agent}
                  effectiveStatus={effectiveStatus(agent)}
                  expanded={expandedAgent === agent.id}
                  onToggle={() => setExpandedAgent(prev => prev === agent.id ? null : agent.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function fmtDuration(secs) {
  if (!secs || secs < 0) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = (secs % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}h ${m}m` : `${m}:${s}`
}

function AgentStatusRow({ agent, effectiveStatus: status, expanded, onToggle }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline
  const Icon = cfg.icon

  const [elapsed, setElapsed] = useState(null)
  const [breakExceeded, setBreakExceeded] = useState(false)

  const setAt = agent.has_leave_today ? null : agent.status_set_at

  useEffect(() => {
    if (!setAt) { setElapsed(null); return }
    function tick() {
      const diff = Math.floor((Date.now() - new Date(setAt)) / 1000)
      const m = Math.floor(diff / 60)
      const s = (diff % 60).toString().padStart(2, '0')
      setElapsed(`${m}:${s}`)
      setBreakExceeded(status === 'break' && m >= BREAK_LIMIT_MINS)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [setAt, status])

  const shiftTime = agent.is_on_shift && agent.shift_start && agent.shift_end
    ? `${agent.shift_start.slice(0, 5)} – ${agent.shift_end.slice(0, 5)}`
    : agent.has_leave_today ? 'On Leave' : '—'

  const today = new Date().toISOString().slice(0, 10)
  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['agent-status-history', agent.id, today],
    queryFn: () => fetch(`/api/users/${agent.id}/status-history?date=${today}`).then(r => r.ok ? r.json() : []),
    enabled: expanded,
    refetchInterval: expanded ? 30000 : false,
  })

  // Totals per status from history
  const totals = history.reduce((acc, h) => {
    acc[h.status] = (acc[h.status] || 0) + (h.duration_secs || 0)
    return acc
  }, {})

  return (
    <>
      <tr className={`border-b border-cortex-border hover:bg-cortex-bg/50 transition-colors ${breakExceeded ? 'bg-cortex-warning/5' : ''}`}>
        <td className="table-cell w-6">
          <button
            onClick={onToggle}
            className="p-1 rounded text-cortex-muted hover:text-cortex-accent transition-colors"
            title="View status timeline"
          >
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td className="table-cell">
          <div>
            <div className="font-medium text-cortex-text">{agent.full_name}</div>
            <div className="text-xs text-cortex-muted font-mono">{agent.email}</div>
          </div>
        </td>
        <td className="table-cell">
          <div className="text-xs text-cortex-muted font-mono">{shiftTime}</div>
          {agent.shift_agent_type && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-cortex-accent/10 text-cortex-accent capitalize">
              {agent.shift_agent_type}
            </span>
          )}
        </td>
        <td className="table-cell">
          <div className={`flex items-center gap-2 ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status !== 'offline' && status !== 'on_leave' ? 'animate-pulse' : ''}`} />
            <Icon className="w-3.5 h-3.5" />
            <span className="text-sm font-medium">{cfg.label}</span>
          </div>
        </td>
        <td className="table-cell text-cortex-muted text-xs">
          {setAt
            ? new Date(setAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : '—'}
        </td>
        <td className="table-cell">
          {elapsed ? (
            <span className={`font-mono text-sm ${breakExceeded ? 'text-cortex-warning font-bold' : 'text-cortex-muted'}`}>
              {elapsed}{breakExceeded && ' ⚠'}
            </span>
          ) : (
            <span className="text-cortex-muted">—</span>
          )}
        </td>
        <td className="table-cell text-cortex-muted text-xs">
          {agent.has_leave_today
            ? <span className="text-indigo-400">Approved leave</span>
            : (agent.status_note || '—')}
        </td>
      </tr>

      {/* Expandable status timeline */}
      {expanded && (
        <tr className="border-b border-cortex-border bg-cortex-bg/40">
          <td colSpan={7} className="px-6 py-4">
            {histLoading ? (
              <div className="flex gap-2">
                {[1,2,3].map(i => <div key={i} className="h-8 w-24 bg-cortex-surface animate-pulse rounded" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-cortex-muted">No status history recorded today.</p>
            ) : (
              <div className="space-y-3">
                {/* Timeline bar */}
                <div className="flex gap-0.5 h-6 rounded overflow-hidden">
                  {history.map((h, i) => {
                    const pct = Math.max(1, Math.round((h.duration_secs / history.reduce((a, x) => a + x.duration_secs, 0)) * 100))
                    const dotColor = STATUS_CONFIG[h.status]?.dot || 'bg-cortex-muted'
                    return (
                      <div
                        key={i}
                        className={`${dotColor} opacity-70 rounded-sm flex-shrink-0`}
                        style={{ width: `${pct}%` }}
                        title={`${STATUS_CONFIG[h.status]?.label || h.status}: ${fmtDuration(h.duration_secs)}`}
                      />
                    )
                  })}
                </div>

                {/* Timeline list */}
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {history.map((h, i) => {
                    const hcfg = STATUS_CONFIG[h.status] || STATUS_CONFIG.offline
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${hcfg.dot} flex-shrink-0`} />
                        <span className="text-cortex-muted">
                          {new Date(h.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <span className={`font-medium ${hcfg.color}`}>{hcfg.label}</span>
                        <span className="font-mono text-cortex-muted">{fmtDuration(h.duration_secs)}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Totals per status */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-cortex-border">
                  {Object.entries(totals).map(([s, secs]) => {
                    const hcfg = STATUS_CONFIG[s] || STATUS_CONFIG.offline
                    return (
                      <span key={s} className={`text-xs px-2 py-0.5 rounded-full bg-cortex-surface border border-cortex-border ${hcfg.color}`}>
                        {hcfg.label} <span className="font-mono font-semibold">{fmtDuration(secs)}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
