'use client'

import { useQuery } from '@tanstack/react-query'
import { getCriticalSLA } from '@/lib/api'
import Link from 'next/link'
import { 
  getSLAStatusColor, 
  getPriorityColor, 
  formatRelativeTime,
  formatDate 
} from '@/lib/utils'
import { Clock, AlertCircle } from 'lucide-react'

export default function SLAPage() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['critical-sla'],
    queryFn: getCriticalSLA,
    refetchInterval: 15000, // Refresh every 15 seconds
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">SLA Monitor</h1>
        <p className="text-cortex-muted">Real-time tracking of service level agreements</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-cortex-critical/10 border-cortex-critical/20">
          <p className="text-sm text-cortex-muted mb-2">Critical</p>
          <p className="text-4xl font-display font-bold text-cortex-critical">
            {tickets?.filter(t => t.sla_status === 'critical').length || 0}
          </p>
        </div>
        <div className="card bg-cortex-danger/10 border-cortex-danger/20">
          <p className="text-sm text-cortex-muted mb-2">At Risk</p>
          <p className="text-4xl font-display font-bold text-cortex-danger">
            {tickets?.filter(t => t.sla_status === 'at_risk').length || 0}
          </p>
        </div>
        <div className="card bg-cortex-warning/10 border-cortex-warning/20">
          <p className="text-sm text-cortex-muted mb-2">Warning</p>
          <p className="text-4xl font-display font-bold text-cortex-warning">
            {tickets?.filter(t => t.sla_status === 'warning').length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-cortex-muted mb-2">Total Monitored</p>
          <p className="text-4xl font-display font-bold">{tickets?.length || 0}</p>
        </div>
      </div>

      {/* Tickets List */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-6 h-6 text-cortex-danger" />
          <h2 className="text-xl font-display font-bold">Active SLA Tickets</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-cortex-bg animate-pulse rounded-lg"></div>
            ))}
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="block p-4 bg-cortex-bg rounded-lg hover:bg-cortex-border/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
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
                          ESC L{ticket.escalation_level}
                        </span>
                      )}
                      <span className="text-xs text-cortex-muted font-mono">
                        {ticket.clickup_task_id?.substring(0, 12)}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold mb-2">{ticket.title}</h3>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-cortex-muted text-xs mb-1">Reporter</p>
                        <p className="font-medium">{ticket.poc_name || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-cortex-muted text-xs mb-1">Created</p>
                        <p className="font-mono text-xs">{formatRelativeTime(ticket.created_at)}</p>
                      </div>
                      {ticket.sla_resolution_due && (
                        <div>
                          <p className="text-cortex-muted text-xs mb-1">Due</p>
                          <p className="font-mono text-xs">{formatDate(ticket.sla_resolution_due)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="mb-2">
                      <p className="text-5xl font-display font-bold text-cortex-danger">
                        {ticket.sla_consumption_pct}%
                      </p>
                    </div>
                    
                    <div className="w-32 h-2 bg-cortex-surface rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          ticket.sla_consumption_pct >= 90 ? 'bg-cortex-critical' :
                          ticket.sla_consumption_pct >= 78 ? 'bg-cortex-danger' :
                          ticket.sla_consumption_pct >= 65 ? 'bg-cortex-warning' :
                          'bg-cortex-success'
                        }`}
                        style={{ width: `${Math.min(ticket.sla_consumption_pct || 0, 100)}%` }}
                      ></div>
                    </div>
                    
                    {ticket.status && (
                      <p className="text-xs text-cortex-muted mt-2">{ticket.status}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-cortex-success opacity-50" />
            <p className="text-cortex-muted">All SLAs are currently healthy</p>
          </div>
        )}
      </div>
    </div>
  )
}
