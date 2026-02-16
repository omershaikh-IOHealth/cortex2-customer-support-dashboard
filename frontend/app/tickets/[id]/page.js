'use client'

import { useQuery } from '@tanstack/react-query'
import { getTicket } from '@/lib/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  getSLAStatusColor, 
  getPriorityColor, 
  getStatusColor,
  getEscalationLevelColor,
  formatDate,
  formatRelativeTime,
  getSentimentEmoji 
} from '@/lib/utils'
import { 
  ArrowLeft, 
  ExternalLink, 
  Clock, 
  User, 
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle 
} from 'lucide-react'

export default function TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    refetchInterval: 30000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-12 bg-cortex-surface animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-cortex-surface animate-pulse rounded-lg"></div>
          ))}
        </div>
        <div className="h-96 bg-cortex-surface animate-pulse rounded-lg"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-16 h-16 mx-auto mb-4 text-cortex-danger" />
        <h2 className="text-2xl font-bold mb-2">Ticket Not Found</h2>
        <p className="text-cortex-muted mb-6">The ticket you're looking for doesn't exist.</p>
        <Link href="/tickets" className="btn-primary">
          Back to Tickets
        </Link>
      </div>
    )
  }

  const { ticket, threads, alerts } = data

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tickets" className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-cortex-muted font-mono">
              {ticket.clickup_task_id}
            </span>
            {ticket.clickup_url && (
              <a
                href={ticket.clickup_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cortex-accent hover:underline text-sm flex items-center gap-1"
              >
                Open in ClickUp <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <h1 className="text-3xl font-display font-bold">{ticket.title}</h1>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`badge ${getPriorityColor(ticket.priority)}`}>
          {ticket.priority}
        </span>
        <span className={`badge ${getStatusColor(ticket.status)}`}>
          {ticket.status}
        </span>
        <span className={`badge ${getSLAStatusColor(ticket.sla_status)}`}>
          SLA: {ticket.sla_status}
        </span>
        {ticket.escalation_level > 0 && (
          <span className={`badge ${getEscalationLevelColor(ticket.escalation_level)}`}>
            Escalation Level {ticket.escalation_level}
          </span>
        )}
        {ticket.ai_sentiment && (
          <span className="badge bg-cortex-surface">
            {getSentimentEmoji(ticket.ai_sentiment)} {ticket.ai_sentiment}
          </span>
        )}
        {ticket.request_type && (
          <span className="badge bg-cortex-surface">
            {ticket.request_type}
          </span>
        )}
      </div>

      {/* Key Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-cortex-accent" />
            <h3 className="font-semibold">Reporter</h3>
          </div>
          <div>
            <p className="font-medium">{ticket.poc_name || ticket.created_by_name || 'Unknown'}</p>
            <p className="text-sm text-cortex-muted">{ticket.poc_email || ticket.created_by_email}</p>
            {ticket.poc_phone && (
              <p className="text-sm text-cortex-muted font-mono mt-1">{ticket.poc_phone}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-cortex-warning" />
            <h3 className="font-semibold">SLA Status</h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-cortex-muted mb-1">Consumption</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-cortex-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      ticket.sla_consumption_pct >= 90 ? 'bg-cortex-critical' :
                      ticket.sla_consumption_pct >= 75 ? 'bg-cortex-danger' :
                      ticket.sla_consumption_pct >= 50 ? 'bg-cortex-warning' :
                      'bg-cortex-success'
                    }`}
                    style={{ width: `${Math.min(ticket.sla_consumption_pct || 0, 100)}%` }}
                  ></div>
                </div>
                <span className="text-sm font-mono font-bold">
                  {ticket.sla_consumption_pct || 0}%
                </span>
              </div>
            </div>
            {ticket.sla_resolution_due && (
              <div>
                <p className="text-xs text-cortex-muted">Resolution Due</p>
                <p className="text-sm font-mono">{formatDate(ticket.sla_resolution_due)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquare className="w-5 h-5 text-cortex-accent" />
            <h3 className="font-semibold">Activity</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-cortex-muted">Created</span>
              <span className="text-sm font-mono">{formatRelativeTime(ticket.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-cortex-muted">Updated</span>
              <span className="text-sm font-mono">{formatRelativeTime(ticket.updated_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-cortex-muted">Thread Count</span>
              <span className="text-sm font-bold">{threads?.length || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {ticket.description && (
        <div className="card">
          <h3 className="font-semibold mb-3">Description</h3>
          <p className="text-cortex-muted whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {/* AI Summary */}
      {ticket.ai_summary && (
        <div className="card bg-cortex-accent/5 border-cortex-accent/20">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span className="text-cortex-accent">✨</span> AI Analysis
          </h3>
          <p className="text-cortex-text">{ticket.ai_summary}</p>
        </div>
      )}

      {/* Escalation Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-cortex-danger" />
            <h3 className="font-semibold">Escalation Alerts</h3>
          </div>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-3 bg-cortex-bg rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className={`badge ${getEscalationLevelColor(alert.alert_level)}`}>
                    Level {alert.alert_level}
                  </span>
                  <span className="text-xs text-cortex-muted font-mono">
                    {formatRelativeTime(alert.created_at)}
                  </span>
                </div>
                <p className="text-sm text-cortex-muted">
                  Consumption: {alert.consumption_pct}%
                </p>
                {alert.notified_emails && alert.notified_emails.length > 0 && (
                  <p className="text-xs text-cortex-muted mt-2">
                    Notified: {alert.notified_emails.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Thread */}
      <div className="card">
        <h3 className="font-semibold mb-6">Activity Thread</h3>
        {threads && threads.length > 0 ? (
          <div className="space-y-4">
            {threads.map((thread, index) => (
              <div key={thread.id} className="relative pl-6 pb-6 border-l-2 border-cortex-border last:pb-0">
                <div className="absolute left-0 top-0 w-2 h-2 -translate-x-[5px] rounded-full bg-cortex-accent"></div>
                
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {thread.actor_name || 'System'}
                        </span>
                        <span className="badge bg-cortex-surface text-xs">
                          {thread.action_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-cortex-muted font-mono">
                        {formatDate(thread.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  {thread.raw_content && (
                    <p className="text-sm text-cortex-text bg-cortex-bg p-3 rounded">
                      {thread.raw_content}
                    </p>
                  )}
                  
                  {thread.ai_summary && (
                    <p className="text-sm text-cortex-accent bg-cortex-accent/5 p-3 rounded">
                      ✨ {thread.ai_summary}
                    </p>
                  )}
                  
                  {thread.has_attachments && (
                    <span className="text-xs text-cortex-muted">
                      📎 Has attachments
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-cortex-muted">No activity recorded</p>
        )}
      </div>

      {/* Metadata */}
      {(ticket.module || ticket.operating_system || ticket.mobile_or_national_id) && (
        <div className="card">
          <h3 className="font-semibold mb-4">Additional Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ticket.module && (
              <div>
                <p className="text-xs text-cortex-muted mb-1">Module</p>
                <p className="text-sm font-medium">{ticket.module}</p>
              </div>
            )}
            {ticket.operating_system && (
              <div>
                <p className="text-xs text-cortex-muted mb-1">OS</p>
                <p className="text-sm font-medium">{ticket.operating_system}</p>
              </div>
            )}
            {ticket.mobile_or_national_id && (
              <div>
                <p className="text-xs text-cortex-muted mb-1">Patient ID</p>
                <p className="text-sm font-mono">{ticket.mobile_or_national_id}</p>
              </div>
            )}
            {ticket.case_type && (
              <div>
                <p className="text-xs text-cortex-muted mb-1">Case Type</p>
                <p className="text-sm font-medium">{ticket.case_type}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
