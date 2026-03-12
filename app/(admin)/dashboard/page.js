'use client'

import { useQuery } from '@tanstack/react-query'
import { getOverviewMetrics, getCriticalSLA, getEscalations, getTickets, getAHTMetrics, getFCRMetrics, getQueueStats } from '@/lib/api'
import { useCompany } from '@/context/CompanyContext'
import MetricCard from '@/components/ui/MetricCard'
import { Ticket, AlertTriangle, Clock, TrendingUp, AlertOctagon, CheckCircle, Activity, Target, Phone, Users, Timer, PhoneMissed } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'
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
  const { company } = useCompany()

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['overview-metrics', company],
    queryFn: () => getOverviewMetrics(company),
    refetchInterval: 30000,
  })
  const { data: criticalSLA, isLoading: slaLoading } = useQuery({
    queryKey: ['critical-sla', company],
    queryFn: () => getCriticalSLA(company),
    refetchInterval: 30000,
  })
  const { data: recentEscalations } = useQuery({
    queryKey: ['escalations', company],
    queryFn: () => getEscalations(company),
    refetchInterval: 30000,
  })
  const { data: recentTickets } = useQuery({
    queryKey: ['recent-tickets', company],
    queryFn: () => getTickets({ limit: 8, company }),
    refetchInterval: 30000,
  })
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then(r => r.json()),
    refetchInterval: 120000,
  })
  const { data: ahtData, isLoading: ahtLoading } = useQuery({
    queryKey: ['aht-metrics'],
    queryFn: getAHTMetrics,
    refetchInterval: 300000,
  })
  const { data: fcrData, isLoading: fcrLoading } = useQuery({
    queryKey: ['fcr-metrics'],
    queryFn: getFCRMetrics,
    refetchInterval: 300000,
  })
  const { data: queueStats, isLoading: queueLoading } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: getQueueStats,
    refetchInterval: 30000,
    retry: false,
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
        <div className="relative">
          <MetricCard
            title="Avg Handle Time"
            value={ahtData?.avg_minutes ? `${ahtData.avg_minutes} min` : '— min'}
            subtitle="Talk time · last 30 days"
            icon={Clock}
            variant="info"
            loading={ahtLoading}
          />
          <div className="absolute top-3 right-3">
            <NewBadge description="Average Handle Time — calculated from the last 30 days of call logs using talk time (or total duration as fallback). Covers all agents." />
          </div>
        </div>
        <div className="relative">
          <MetricCard
            title="FCR Rate"
            value={fcrData?.fcr_rate != null ? `${fcrData.fcr_rate}%` : '—%'}
            subtitle="No-ticket calls · last 30 days"
            icon={Target}
            variant={fcrData?.fcr_rate >= 70 ? 'success' : fcrData?.fcr_rate >= 50 ? 'warning' : 'critical'}
            loading={fcrLoading}
          />
          <div className="absolute top-3 right-3">
            <NewBadge description="First Call Resolution Rate — % of calls that were handled without creating a support ticket. Higher is better. Last 30 days, all agents." />
          </div>
        </div>
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

      {/* Queue Health */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-cortex-accent" />
            <h2 className="font-display font-bold text-cortex-text">Queue Health</h2>
            <span className="text-[10px] text-cortex-muted font-mono">Today · live</span>
          </div>
          <NewBadge description="Live ZIWO queue stats for today — refreshes every 30 seconds. Shows agent availability, inbound call volume, average wait time, and abandoned calls." />
        </div>
        {queueStats?.error ? (
          <p className="text-xs text-cortex-muted text-center py-4">{queueStats.error}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Available Agents',
                value: queueLoading ? '—' : (queueStats?.available_agents ?? '—'),
                sub: queueStats?.total_agents != null ? `of ${queueStats.total_agents} total` : 'agents',
                icon: Users,
                color: 'text-cortex-success',
                bg: 'bg-cortex-success/10',
              },
              {
                label: 'Inbound Today',
                value: queueLoading ? '—' : (queueStats?.total_inbound ?? '—'),
                sub: 'calls received',
                icon: Phone,
                color: 'text-cortex-accent',
                bg: 'bg-cortex-accent/10',
              },
              {
                label: 'Avg Wait Time',
                value: queueLoading ? '—' : (queueStats?.avg_wait_secs != null ? `${Math.round(queueStats.avg_wait_secs)}s` : '—'),
                sub: 'seconds per call',
                icon: Timer,
                color: 'text-cortex-warning',
                bg: 'bg-cortex-warning/10',
              },
              {
                label: 'Abandoned',
                value: queueLoading ? '—' : (queueStats?.total_abandoned ?? '—'),
                sub: 'calls dropped',
                icon: PhoneMissed,
                color: 'text-cortex-danger',
                bg: 'bg-cortex-danger/10',
              },
            ].map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-cortex-border bg-cortex-bg">
                <div className={`p-2 rounded-lg flex-shrink-0 ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-cortex-muted leading-tight">{label}</p>
                  <p className="text-[10px] text-cortex-muted/60 leading-tight">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}
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
