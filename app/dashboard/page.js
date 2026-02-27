'use client'

import { useQuery } from '@tanstack/react-query'
import { 
  getOverviewMetrics, 
  getCriticalSLA, 
  getEscalations,
  getTickets 
} from '@/lib/api'
import MetricCard from '@/components/ui/MetricCard'
import { 
  Ticket, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  AlertOctagon,
  CheckCircle 
} from 'lucide-react'
import Link from 'next/link'
import { getSLAStatusColor, getPriorityColor, formatRelativeTime } from '@/lib/utils'
import { useEffect } from 'react'

export default function DashboardPage() {
  // Auto-refresh every 30 seconds
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
    queryFn: () => getTickets({ limit: 10 }),
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">Mission Control</h1>
        <p className="text-cortex-muted">Real-time overview of support operations</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Tickets"
          value={metrics?.active_tickets || 0}
          subtitle="Currently open"
          icon={Ticket}
          variant="info"
          loading={metricsLoading}
        />
        <MetricCard
          title="Critical SLA"
          value={metrics?.critical_sla || 0}
          subtitle="Requires immediate attention"
          icon={AlertOctagon}
          variant="critical"
          loading={metricsLoading}
        />
        <MetricCard
          title="High Escalations"
          value={metrics?.high_escalations || 0}
          subtitle="Level 3+ escalations"
          icon={AlertTriangle}
          variant="warning"
          loading={metricsLoading}
        />
        <MetricCard
          title="Avg SLA Consumption"
          value={metrics?.avg_sla_consumption ? `${metrics.avg_sla_consumption}%` : '0%'}
          subtitle="Across all active tickets"
          icon={Clock}
          variant={metrics?.avg_sla_consumption > 75 ? 'warning' : 'success'}
          loading={metricsLoading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Last 24 Hours</h3>
            <TrendingUp className="w-5 h-5 text-cortex-accent" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-cortex-muted text-sm">New Tickets</span>
              <span className="text-2xl font-display font-bold">{metrics?.tickets_24h || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cortex-muted text-sm">SLA Breaches</span>
              <span className="text-2xl font-display font-bold text-cortex-danger">
                {metrics?.breached_sla || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="card col-span-2">
          <h3 className="text-lg font-semibold mb-4">System Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-cortex-success rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium">ClickUp Sync</p>
                <p className="text-xs text-cortex-muted font-mono">Operational</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-cortex-success rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium">Database</p>
                <p className="text-xs text-cortex-muted font-mono">Connected</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-cortex-success rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium">AI Analysis</p>
                <p className="text-xs text-cortex-muted font-mono">Active</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-cortex-success rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium">Escalations</p>
                <p className="text-xs text-cortex-muted font-mono">Monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical SLA Tickets */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold">Critical SLA Tickets</h2>
          <Link href="/sla" className="text-sm text-cortex-accent hover:underline">
            View All →
          </Link>
        </div>
        {slaLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-cortex-bg animate-pulse rounded-lg"></div>
            ))}
          </div>
        ) : criticalSLA && criticalSLA.length > 0 ? (
          <div className="space-y-3">
            {criticalSLA.slice(0, 5).map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="block p-4 bg-cortex-bg rounded-lg hover:bg-cortex-border/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                      <span className={`badge ${getSLAStatusColor(ticket.sla_status)}`}>
                        {ticket.sla_status}
                      </span>
                      {ticket.escalation_level > 0 && (
                        <span className="badge bg-cortex-danger/10 text-cortex-danger">
                          L{ticket.escalation_level}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold mb-1">{ticket.title}</h3>
                    <p className="text-sm text-cortex-muted">
                      {ticket.poc_name} • {formatRelativeTime(ticket.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-display font-bold text-cortex-danger">
                      {ticket.sla_consumption_pct}%
                    </p>
                    <p className="text-xs text-cortex-muted font-mono">SLA</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-cortex-muted">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No critical SLA tickets at the moment</p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold">Recent Tickets</h2>
            <Link href="/tickets" className="text-sm text-cortex-accent hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {recentTickets?.slice(0, 5).map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="block p-3 bg-cortex-bg rounded-lg hover:bg-cortex-border/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span className="text-xs text-cortex-muted font-mono">
                    {ticket.clickup_task_id?.substring(0, 8)}
                  </span>
                </div>
                <h4 className="text-sm font-medium mb-1">{ticket.title}</h4>
                <p className="text-xs text-cortex-muted">
                  {formatRelativeTime(ticket.created_at)}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Escalations */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold">Recent Escalations</h2>
            <Link href="/escalations" className="text-sm text-cortex-accent hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {recentEscalations?.slice(0, 5).map((escalation) => (
              <div
                key={escalation.id}
                className="p-3 bg-cortex-bg rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="badge bg-cortex-danger/10 text-cortex-danger">
                    Level {escalation.alert_level}
                  </span>
                  <span className="text-xs text-cortex-muted font-mono">
                    {escalation.consumption_pct}% SLA
                  </span>
                </div>
                <h4 className="text-sm font-medium mb-1">{escalation.title}</h4>
                <p className="text-xs text-cortex-muted">
                  {formatRelativeTime(escalation.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
