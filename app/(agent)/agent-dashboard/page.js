'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, BarChart2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getCalls } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'

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

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['my-calls'],
    queryFn: () => getCalls({ limit: 50 }),
    refetchInterval: 30000,
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

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Overview</p>
        <h1 className="text-3xl font-display font-bold text-cortex-text">My Dashboard</h1>
        {session?.user?.name && (
          <p className="text-sm text-cortex-muted mt-0.5">{session.user.name} · last 50 calls</p>
        )}
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
      </div>

      {/* Recent call log */}
      <div className="card">
        <h2 className="font-semibold text-cortex-text mb-5 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cortex-accent" />
          Recent Calls
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 rounded-xl bg-cortex-bg animate-pulse" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <EmptyState icon={Phone} title="No calls logged yet" message="Your recent call history will appear here." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cortex-border">
                  <th className="table-header">Direction</th>
                  <th className="table-header">Number</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header">Cause</th>
                  <th className="table-header">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cortex-border">
                {calls.slice(0, 20).map(c => (
                  <tr key={c.id} className="hover:bg-cortex-surface-raised transition-colors">
                    <td className="table-cell">
                      <span className={`badge text-xs ${
                        c.direction === 'inbound'
                          ? 'text-cortex-success bg-cortex-success/10'
                          : 'text-cortex-warning bg-cortex-warning/10'
                      }`}>
                        {c.direction === 'inbound' ? '↓' : '↑'} {c.direction}
                      </span>
                    </td>
                    <td className="table-cell font-mono text-xs text-cortex-muted">{c.customer_number || '—'}</td>
                    <td className="table-cell font-mono text-sm">{fmtSecs(c.duration_secs)}</td>
                    <td className="table-cell text-sm text-cortex-muted capitalize">{c.hangup_cause || 'normal'}</td>
                    <td className="table-cell text-xs text-cortex-muted">{formatDate(c.started_at)}</td>
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
