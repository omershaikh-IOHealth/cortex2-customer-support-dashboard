'use client'

import { useQuery } from '@tanstack/react-query'
import { getEscalations } from '@/lib/api'
import Link from 'next/link'
import { getEscalationLevelColor, formatDate, formatRelativeTime } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export default function EscalationsPage() {
  const { data: escalations, isLoading } = useQuery({
    queryKey: ['escalations'],
    queryFn: getEscalations,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">Escalations</h1>
        <p className="text-cortex-muted">SLA alerts and escalation notifications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((level) => (
          <div key={level} className="card">
            <p className="text-sm text-cortex-muted mb-2">Level {level}</p>
            <p className="text-4xl font-display font-bold">
              {escalations?.filter(e => e.alert_level === level).length || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Escalations List */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-cortex-danger" />
          <h2 className="text-xl font-display font-bold">Recent Escalations</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-cortex-bg animate-pulse rounded-lg"></div>
            ))}
          </div>
        ) : escalations && escalations.length > 0 ? (
          <div className="space-y-4">
            {escalations.map((escalation) => (
              <div
                key={escalation.id}
                className="p-4 bg-cortex-bg rounded-lg hover:bg-cortex-border/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${getEscalationLevelColor(escalation.alert_level)}`}>
                        Level {escalation.alert_level}
                      </span>
                      <span className="badge bg-cortex-surface">
                        {escalation.consumption_pct}% SLA
                      </span>
                      <span className="text-xs text-cortex-muted font-mono">
                        {escalation.clickup_task_id?.substring(0, 12)}
                      </span>
                      {escalation.is_acknowledged && (
                        <span className="badge bg-cortex-success/10 text-cortex-success">
                          Acknowledged
                        </span>
                      )}
                    </div>

                    <Link 
                      href={`/tickets/${escalation.ticket_id}`}
                      className="font-semibold hover:text-cortex-accent transition-colors mb-2 block"
                    >
                      {escalation.title}
                    </Link>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-cortex-muted text-xs mb-1">Priority</p>
                        <p className="font-medium">{escalation.priority}</p>
                      </div>
                      <div>
                        <p className="text-cortex-muted text-xs mb-1">Channel</p>
                        <p className="font-medium">{escalation.notification_channel || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-cortex-muted text-xs mb-1">Escalated</p>
                        <p className="font-mono text-xs">{formatRelativeTime(escalation.created_at)}</p>
                      </div>
                    </div>

                    {escalation.notified_emails && escalation.notified_emails.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-cortex-border">
                        <p className="text-xs text-cortex-muted mb-1">Notified:</p>
                        <div className="flex flex-wrap gap-2">
                          {escalation.notified_emails.map((email, idx) => (
                            <span key={idx} className="badge bg-cortex-surface text-xs">
                              {email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {escalation.acknowledged_by && (
                      <p className="text-xs text-cortex-muted mt-2">
                        Acknowledged by {escalation.acknowledged_by} at {formatDate(escalation.acknowledged_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-12 text-cortex-muted">No escalations recorded</p>
        )}
      </div>
    </div>
  )
}
