'use client'

import { useQuery } from '@tanstack/react-query'
import { getOverviewMetrics, getCriticalSLA, getEscalations, getTickets } from '@/lib/api'
import MetricCard from '@/components/ui/MetricCard'
import { Ticket, AlertTriangle, Clock, TrendingUp, AlertOctagon, CheckCircle, Activity } from 'lucide-react'
import Link from 'next/link'
import { getSLAStatusColor, getPriorityColor, formatRelativeTime } from '@/lib/utils'

function SLABar({ pct, status }) {
  const color =
    status === 'critical' ? 'bg-cortex-critical' :
    status === 'at_risk'  ? 'bg-cortex-danger'   :
    status === 'warning'  ? 'bg-cortex-warning'  :
    'bg-cortex-success'
  return (
    <div className="w-full h-1.5 bg-cortex-border rounded-full overflow-hidden mt-2">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct || 0, 100)}%` }} />
    </div>
  )
}

function StatusDot({ status }) {
  const isGood = ['operational', 'configured'].includes(status)
  const isBad  = ['down', 'error'].includes(status)
  const isWarn = status === 'degraded'
  const cls = isGood ? 'bg-cortex-success' : isBad ? 'bg-cortex-danger' : isWarn ? 'bg-cortex-warning' : 'bg-cortex-muted'
  const label = !status ? 'Checking…' :
    status === 'operational'    ? 'Operational' :
    status === 'configured'     ? 'Configured'  :
    status === 'not_configured' ? 'Not configured' :
    status === 'degraded'       ? 'Degraded'    :
    status === 'down'           ? 'Down'        : status
  const textCls = isGood ? 'text-cortex-success' : isBad ? 'text-cortex-danger' : isWarn ? 'text-cortex-warning' : 'text-cortex-muted'
  return { cls, label, textCls }
}

export default function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['overview-metrics'],
    queryFn: getOverviewMetrics,
    refetchInterval: 30000,
  })
  const { data: criticalSLA, isLoading: slaLoading } = useQuery({
    queryKey: ['critical-sla'],
    queryFn: getCriticalSLA,
    refetchInterval: 30000,
  })
  const { data: recentEscalations } = useQuery({
    queryKey: ['escalations'],
    queryFn: getEscalations,
    refetchInterval: 30000,
  })
  const { data: recentTickets } = useQuery({
    queryKey: ['recent-tickets'],
    queryFn: () => getTickets({ limit: 8 }),
    refetchInterval: 30000,
  })
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then(r => r.json()),
    refetchInterval: 120000,
  })

  const systemChecks = [
    { key: 'database', label: 'Database' },
    { key: 'clickup',  label: 'ClickUp' },
    { key: 'ai',       label: 'AI' },
    { key: 'n8n',      label: 'n8n' },
  ]

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Overview</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">Mission Control</h1>
        </div>
        <p className="text-xs text-cortex-muted font-mono pb-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active Tickets"      value={metrics?.active_tickets || 0}      subtitle="Currently open"               icon={Ticket}       variant="info"     loading={metricsLoading} />
        <MetricCard title="Critical SLA"        value={metrics?.critical_sla || 0}         subtitle="Immediate attention needed"   icon={AlertOctagon} variant="critical" loading={metricsLoading} />
        <MetricCard title="High Escalations"    value={metrics?.high_escalations || 0}     subtitle="Level 3+ escalations"         icon={AlertTriangle} variant="warning" loading={metricsLoading} />
        <MetricCard
          title="Avg SLA Consumption"
          value={metrics?.avg_sla_consumption ? `${metrics.avg_sla_consumption}%` : '0%'}
          subtitle="Across active tickets"
          icon={Clock}
          variant={metrics?.avg_sla_consumption > 75 ? 'warning' : 'success'}
          loading={metricsLoading}
        />
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* 24h snapshot */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider">Last 24 Hours</p>
            <TrendingUp className="w-4 h-4 text-cortex-accent" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-cortex-muted">New tickets</span>
              <span className="text-2xl font-display font-bold text-cortex-text">{metrics?.tickets_24h || 0}</span>
            </div>
            <div className="h-px bg-cortex-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-cortex-muted">SLA breaches</span>
              <span className="text-2xl font-display font-bold text-cortex-danger">{metrics?.breached_sla || 0}</span>
            </div>
          </div>
        </div>

        {/* System status */}
        <div className="card col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider">System Status</p>
            <Activity className="w-4 h-4 text-cortex-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {systemChecks.map(({ key, label }) => {
              const check = healthData?.checks?.[key]
              const { cls, label: statusLabel, textCls } = StatusDot({ status: check?.status })
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-cortex-bg border border-cortex-border">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls} ${check?.status && ['operational','configured'].includes(check.status) ? 'animate-pulse' : ''}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-cortex-text">{label}</p>
                    <p className={`text-xs font-mono ${textCls}`}>{statusLabel}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Critical SLA */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cortex-danger" />
            <h2 className="font-display font-bold text-cortex-text">Critical SLA Tickets</h2>
          </div>
          <Link href="/sla" className="text-xs text-cortex-accent hover:underline font-medium">
            View all →
          </Link>
        </div>

        {slaLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-cortex-bg animate-pulse rounded-xl" />)}
          </div>
        ) : criticalSLA && criticalSLA.length > 0 ? (
          <div className="space-y-2">
            {criticalSLA.slice(0, 5).map(ticket => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-cortex-bg border border-cortex-border hover:border-cortex-accent/40 hover:bg-cortex-surface-raised transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                    <span className={`badge ${getSLAStatusColor(ticket.sla_status)}`}>{ticket.sla_status}</span>
                    {ticket.escalation_level > 0 && (
                      <span className="badge bg-cortex-danger/10 text-cortex-danger">L{ticket.escalation_level}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-cortex-text truncate group-hover:text-cortex-accent transition-colors">
                    {ticket.title}
                  </p>
                  <SLABar pct={ticket.sla_consumption_pct} status={ticket.sla_status} />
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-display font-bold text-cortex-danger">{ticket.sla_consumption_pct}%</p>
                  <p className="text-xs text-cortex-muted font-mono">{formatRelativeTime(ticket.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-cortex-success opacity-60" />
            <p className="text-sm text-cortex-muted">All SLAs are within threshold</p>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent tickets */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-cortex-accent" />
              <h2 className="font-display font-bold text-cortex-text">Recent Tickets</h2>
            </div>
            <Link href="/tickets" className="text-xs text-cortex-accent hover:underline font-medium">View all →</Link>
          </div>
          <div className="space-y-1.5">
            {(recentTickets?.tickets ?? recentTickets ?? []).slice(0, 6).map(ticket => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-cortex-surface-raised transition-colors group"
              >
                <span className={`badge ${getPriorityColor(ticket.priority)} flex-shrink-0`}>{ticket.priority}</span>
                <span className="text-sm text-cortex-text truncate flex-1 group-hover:text-cortex-accent transition-colors">
                  {ticket.title}
                </span>
                <span className="text-xs text-cortex-muted font-mono flex-shrink-0">{formatRelativeTime(ticket.created_at)}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent escalations */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-cortex-warning" />
              <h2 className="font-display font-bold text-cortex-text">Recent Escalations</h2>
            </div>
            <Link href="/escalations" className="text-xs text-cortex-accent hover:underline font-medium">View all →</Link>
          </div>
          <div className="space-y-1.5">
            {(recentEscalations ?? []).slice(0, 6).map(esc => (
              <div key={esc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                <span className="badge bg-cortex-danger/10 text-cortex-danger flex-shrink-0">L{esc.alert_level}</span>
                <span className="text-sm text-cortex-text truncate flex-1">{esc.title}</span>
                <span className="text-xs text-cortex-muted font-mono flex-shrink-0">{esc.consumption_pct}%</span>
              </div>
            ))}
            {(!recentEscalations || recentEscalations.length === 0) && (
              <p className="text-sm text-cortex-muted text-center py-6">No recent escalations</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
