'use client'

import { useQuery } from '@tanstack/react-query'
import { getEscalations } from '@/lib/api'
import Link from 'next/link'
import { getEscalationLevelColor, formatDate, formatRelativeTime } from '@/lib/utils'
import { AlertTriangle, CheckCircle } from 'lucide-react'

const LEVEL_CONFIG = [
  { level: 1, label: 'Level 1', color: 'text-cortex-warning',  border: 'border-t-cortex-warning',  bg: 'bg-cortex-warning/5'  },
  { level: 2, label: 'Level 2', color: 'text-orange-400',      border: 'border-t-orange-400',       bg: 'bg-orange-400/5'      },
  { level: 3, label: 'Level 3', color: 'text-cortex-danger',   border: 'border-t-cortex-danger',    bg: 'bg-cortex-danger/5'   },
  { level: 4, label: 'Level 4', color: 'text-cortex-critical', border: 'border-t-cortex-critical',  bg: 'bg-cortex-critical/5' },
]

export default function EscalationsPage() {
  const { data: escalations, isLoading } = useQuery({
    queryKey: ['escalations'],
    queryFn: getEscalations,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Alerts</p>
        <h1 className="text-3xl font-display font-bold text-cortex-text">Escalations</h1>
      </div>

      {/* Level stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {LEVEL_CONFIG.map(({ level, label, color, border, bg }) => (
          <div key={level} className={`card border-t-2 ${border} ${bg}`}>
            <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-3">{label}</p>
            <p className={`text-4xl font-display font-bold ${color}`}>
              {escalations?.filter(e => e.alert_level === level).length || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Escalations list */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="w-4 h-4 text-cortex-danger" />
          <h2 className="font-display font-bold text-cortex-text">Recent Escalations</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-cortex-bg animate-pulse rounded-xl" />)}
          </div>
        ) : escalations && escalations.length > 0 ? (
          <div className="space-y-3">
            {escalations.map(esc => (
              <div key={esc.id} className="p-4 rounded-xl bg-cortex-bg border border-cortex-border hover:border-cortex-border-strong transition-colors">

                {/* Top row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${getEscalationLevelColor(esc.alert_level)}`}>Level {esc.alert_level}</span>
                    <span className="badge bg-cortex-surface-raised text-cortex-muted">{esc.consumption_pct}% SLA</span>
                    {esc.is_acknowledged && (
                      <span className="badge bg-cortex-success/10 text-cortex-success">Acknowledged</span>
                    )}
                  </div>
                  <span className="text-xs text-cortex-muted font-mono flex-shrink-0">{formatRelativeTime(esc.created_at)}</span>
                </div>

                {/* Title */}
                <Link
                  href={`/tickets/${esc.ticket_id}`}
                  className="font-medium text-cortex-text hover:text-cortex-accent transition-colors block mb-3"
                >
                  {esc.title}
                </Link>

                {/* Meta grid */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-cortex-muted mb-0.5">Priority</p>
                    <p className="font-medium text-cortex-text">{esc.priority || '—'}</p>
                  </div>
                  <div>
                    <p className="text-cortex-muted mb-0.5">Channel</p>
                    <p className="font-medium text-cortex-text">{esc.notification_channel || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-cortex-muted mb-0.5">Task ID</p>
                    <p className="font-mono text-cortex-text">{esc.clickup_task_id?.substring(0, 12) || '—'}</p>
                  </div>
                </div>

                {/* Notified emails */}
                {esc.notified_emails?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cortex-border flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-cortex-muted">Notified:</span>
                    {esc.notified_emails.map((email, i) => (
                      <span key={i} className="badge bg-cortex-surface-raised text-cortex-muted text-xs">{email}</span>
                    ))}
                  </div>
                )}

                {esc.acknowledged_by && (
                  <p className="text-xs text-cortex-muted mt-2 pt-2 border-t border-cortex-border">
                    Acknowledged by <span className="text-cortex-text">{esc.acknowledged_by}</span> · {formatDate(esc.acknowledged_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-14">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-cortex-success opacity-50" />
            <p className="font-medium text-cortex-text mb-1">No escalations recorded</p>
            <p className="text-sm text-cortex-muted">All tickets are within SLA thresholds</p>
          </div>
        )}
      </div>
    </div>
  )
}
