'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Phone, Coffee, Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react'

const STATUS_CONFIG = {
  available:  { label: 'Available',  color: 'text-cortex-success', dot: 'bg-cortex-success',  icon: Wifi },
  busy:       { label: 'On Call',    color: 'text-cortex-warning', dot: 'bg-cortex-warning',  icon: Phone },
  break:      { label: 'On Break',   color: 'text-blue-400',       dot: 'bg-blue-400',         icon: Coffee },
  not_ready:  { label: 'Not Ready',  color: 'text-cortex-danger',  dot: 'bg-cortex-danger',   icon: AlertTriangle },
  offline:    { label: 'Offline',    color: 'text-cortex-muted',   dot: 'bg-cortex-muted',    icon: WifiOff },
}

const BREAK_LIMIT_MINS = 30 // warn if break exceeds this

function fetchAllAgentStatus() {
  return fetch('/api/users').then(r => r.ok ? r.json() : [])
    .then(users => users.filter(u => u.role === 'agent'))
}

export default function AgentStatusSection() {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['admin-agent-status'],
    queryFn: fetchAllAgentStatus,
    refetchInterval: 30000, // poll every 30s
  })

  const statusGroups = Object.fromEntries(
    Object.keys(STATUS_CONFIG).map(s => [s, agents.filter(a => (a.status || 'offline') === s)])
  )

  const onlineCount = agents.filter(a => a.status && a.status !== 'offline').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cortex-accent/10 rounded-lg">
          <Users className="w-5 h-5 text-cortex-accent" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-cortex-text">Agent Status Viewer</h2>
          <p className="text-xs text-cortex-muted">
            {onlineCount} online · {agents.length} total · auto-refreshes every 30s
          </p>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-2 bg-cortex-surface border border-cortex-border rounded-lg px-3 py-2">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-cortex-muted">{cfg.label}</span>
            <span className="text-sm font-bold text-cortex-text">{statusGroups[key]?.length || 0}</span>
          </div>
        ))}
      </div>

      {/* Agent table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-cortex-surface animate-pulse rounded-lg" />)}</div>
      ) : agents.length === 0 ? (
        <div className="card text-center py-8 text-cortex-muted text-sm">No agents found.</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header">Agent</th>
                <th className="table-header">Status</th>
                <th className="table-header">Since</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Note</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <AgentStatusRow key={agent.id} agent={agent} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AgentStatusRow({ agent }) {
  const status = agent.status || 'offline'
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.offline
  const Icon = cfg.icon

  const [elapsed, setElapsed] = useState(null)
  const [breakExceeded, setBreakExceeded] = useState(false)

  useEffect(() => {
    if (!agent.set_at) { setElapsed(null); return }
    function tick() {
      const diff = Math.floor((Date.now() - new Date(agent.set_at)) / 1000)
      const m = Math.floor(diff / 60)
      const s = (diff % 60).toString().padStart(2, '0')
      setElapsed(`${m}:${s}`)
      setBreakExceeded(status === 'break' && m >= BREAK_LIMIT_MINS)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [agent.set_at, status])

  return (
    <tr className={`border-b border-cortex-border hover:bg-cortex-bg/50 ${breakExceeded ? 'bg-cortex-warning/5' : ''}`}>
      <td className="table-cell">
        <div>
          <div className="font-medium text-cortex-text">{agent.full_name}</div>
          <div className="text-xs text-cortex-muted font-mono">{agent.email}</div>
        </div>
      </td>
      <td className="table-cell">
        <div className={`flex items-center gap-2 ${cfg.color}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status !== 'offline' ? 'animate-pulse' : ''}`} />
          <Icon className="w-3.5 h-3.5" />
          <span className="text-sm font-medium">{cfg.label}</span>
        </div>
      </td>
      <td className="table-cell text-cortex-muted text-xs">
        {agent.set_at
          ? new Date(agent.set_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '—'}
      </td>
      <td className="table-cell">
        {elapsed ? (
          <span className={`font-mono text-sm ${breakExceeded ? 'text-cortex-warning font-bold' : 'text-cortex-muted'}`}>
            {elapsed}
            {breakExceeded && ' ⚠'}
          </span>
        ) : (
          <span className="text-cortex-muted">—</span>
        )}
      </td>
      <td className="table-cell text-cortex-muted text-xs">
        {agent.status_note || '—'}
      </td>
    </tr>
  )
}
