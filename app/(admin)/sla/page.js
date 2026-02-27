'use client'

import { useQuery } from '@tanstack/react-query'
import { getCriticalSLA } from '@/lib/api'
import Link from 'next/link'
import { getSLAStatusColor, getPriorityColor, formatRelativeTime, formatDate } from '@/lib/utils'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'

const STAT_CONFIG = [
  { key: 'critical', label: 'Critical',       color: 'text-cortex-critical', border: 'border-t-cortex-critical', bg: 'bg-cortex-critical/5' },
  { key: 'at_risk',  label: 'At Risk',         color: 'text-cortex-danger',   border: 'border-t-cortex-danger',   bg: 'bg-cortex-danger/5'   },
  { key: 'warning',  label: 'Warning',         color: 'text-cortex-warning',  border: 'border-t-cortex-warning',  bg: 'bg-cortex-warning/5'  },
  { key: 'all',      label: 'Total Monitored', color: 'text-cortex-text',     border: '',                         bg: ''                     },
]

export default function SLAPage() {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['critical-sla'],
    queryFn: getCriticalSLA,
    refetchInterval: 15000,
  })

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Monitor</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">SLA Monitor</h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-cortex-muted font-mono pb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cortex-success animate-pulse" />
          Refreshing every 15s
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map(({ key, label, color, border, bg }) => {
          const count = key === 'all'
            ? (tickets?.length || 0)
            : (tickets?.filter(t => t.sla_status === key).length || 0)
          return (
            <div key={key} className={`card border-t-2 ${border || 'border-t-cortex-border'} ${bg}`}>
              <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-3">{label}</p>
              <p className={`text-4xl font-display font-bold ${color}`}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Tickets list */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-4 h-4 text-cortex-danger" />
          <h2 className="font-display font-bold text-cortex-text">Active SLA Tickets</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-cortex-bg animate-pulse rounded-xl" />)}
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map(ticket => {
              const pct = ticket.sla_consumption_pct || 0
              const barColor =
                pct >= 90 ? 'bg-cortex-critical' :
                pct >= 78 ? 'bg-cortex-danger'   :
                pct >= 65 ? 'bg-cortex-warning'  :
                'bg-cortex-success'

              return (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-start gap-6 p-4 rounded-xl bg-cortex-bg border border-cortex-border hover:border-cortex-accent/40 hover:bg-cortex-surface-raised transition-all group"
                >
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                      <span className={`badge ${getSLAStatusColor(ticket.sla_status)}`}>{ticket.sla_status}</span>
                      {ticket.escalation_level > 0 && (
                        <span className="badge bg-cortex-danger/10 text-cortex-danger">ESC L{ticket.escalation_level}</span>
                      )}
                      <span className="text-xs text-cortex-muted font-mono">{ticket.clickup_task_id?.substring(0, 12)}</span>
                    </div>
                    <p className="font-medium text-cortex-text group-hover:text-cortex-accent transition-colors mb-3 truncate">
                      {ticket.title}
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-cortex-muted mb-0.5">Reporter</p>
                        <p className="font-medium text-cortex-text">{ticket.poc_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-cortex-muted mb-0.5">Created</p>
                        <p className="font-mono text-cortex-text">{formatRelativeTime(ticket.created_at)}</p>
                      </div>
                      {ticket.sla_resolution_due && (
                        <div>
                          <p className="text-cortex-muted mb-0.5">Due</p>
                          <p className="font-mono text-cortex-text">{formatDate(ticket.sla_resolution_due)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: SLA gauge */}
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-4xl font-display font-bold leading-none mb-2 ${
                      pct >= 90 ? 'text-cortex-critical' :
                      pct >= 78 ? 'text-cortex-danger'   :
                      pct >= 65 ? 'text-cortex-warning'  : 'text-cortex-success'
                    }`}>
                      {pct}%
                    </p>
                    <div className="w-28 h-2 bg-cortex-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    {ticket.status && (
                      <p className="text-xs text-cortex-muted font-mono mt-1.5">{ticket.status}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-14">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-cortex-success opacity-50" />
            <p className="font-medium text-cortex-text mb-1">All SLAs healthy</p>
            <p className="text-sm text-cortex-muted">No tickets at or above the warning threshold</p>
          </div>
        )}
      </div>
    </div>
  )
}
