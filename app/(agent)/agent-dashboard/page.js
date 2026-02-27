'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, BarChart2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

function fetchMyCalls() {
  return fetch('/api/calls?limit=50').then(r => r.ok ? r.json() : [])
}

function MetricTile({ label, value, sub, icon: Icon, color = 'text-cortex-accent' }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-mono text-cortex-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-3xl font-display font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-cortex-muted">{sub}</p>}
    </div>
  )
}

export default function AgentDashboardPage() {
  const { data: session } = useSession()

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['my-calls'],
    queryFn: fetchMyCalls,
    refetchInterval: 30000,
  })

  // Compute metrics from call log
  const total = calls.length
  const inbound = calls.filter(c => c.direction === 'inbound').length
  const outbound = calls.filter(c => c.direction === 'outbound').length
  const answered = calls.filter(c => c.hangup_cause !== 'missed' && c.duration_secs > 0).length
  const avgDuration = total > 0
    ? Math.round(calls.reduce((s, c) => s + (c.duration_secs || 0), 0) / total)
    : 0

  // Today's calls
  const today = new Date().toDateString()
  const todayCalls = calls.filter(c => new Date(c.started_at).toDateString() === today)

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-cortex-text">My Dashboard</h1>
        <p className="text-cortex-muted text-sm mt-0.5">
          {session?.user?.name} · Last 50 calls
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Total Calls"
          value={total}
          sub={`${todayCalls.length} today`}
          icon={Phone}
          color="text-cortex-accent"
        />
        <MetricTile
          label="Inbound"
          value={inbound}
          sub={`${total ? Math.round((inbound / total) * 100) : 0}% of total`}
          icon={PhoneIncoming}
          color="text-cortex-success"
        />
        <MetricTile
          label="Outbound"
          value={outbound}
          sub={`${total ? Math.round((outbound / total) * 100) : 0}% of total`}
          icon={PhoneOutgoing}
          color="text-cortex-warning"
        />
        <MetricTile
          label="Avg Handle Time"
          value={fmtSecs(avgDuration)}
          sub={`${answered} answered`}
          icon={Clock}
          color="text-cortex-text"
        />
      </div>

      {/* Recent call log */}
      <div className="card">
        <h2 className="font-semibold text-cortex-text mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cortex-accent" />
          Recent Calls
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 rounded bg-cortex-border/30 animate-pulse" />)}
          </div>
        ) : calls.length === 0 ? (
          <p className="text-cortex-muted text-sm text-center py-6">No calls logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header">Direction</th>
                  <th className="table-header">Number</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header">Cause</th>
                  <th className="table-header">When</th>
                </tr>
              </thead>
              <tbody>
                {calls.slice(0, 20).map(c => (
                  <tr key={c.id} className="border-b border-cortex-border hover:bg-cortex-bg/50">
                    <td className="table-cell">
                      <span className={`badge text-xs ${
                        c.direction === 'inbound'
                          ? 'text-cortex-success bg-cortex-success/10'
                          : 'text-cortex-warning bg-cortex-warning/10'
                      }`}>
                        {c.direction === 'inbound' ? '↓' : '↑'} {c.direction}
                      </span>
                    </td>
                    <td className="table-cell font-mono text-cortex-muted">{c.customer_number || '—'}</td>
                    <td className="table-cell font-mono">{fmtSecs(c.duration_secs)}</td>
                    <td className="table-cell text-cortex-muted capitalize">{c.hangup_cause || 'normal'}</td>
                    <td className="table-cell text-cortex-muted">{formatDate(c.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
