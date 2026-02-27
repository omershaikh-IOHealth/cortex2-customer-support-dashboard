'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTicket, getSimilarTickets, addTicketNote, holdTicket, getUsers } from '@/lib/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
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
  XCircle,
  Bot,
  PauseCircle,
  PlayCircle,
  StickyNote,
  Plus,
  ChevronDown,
  ChevronUp,
  History,
  Maximize2,
  Minimize2,
  ArrowUpCircle,
  UserCheck,
  RefreshCw,
} from 'lucide-react'
import { openCompanionWith } from '@/components/ui/AICompanion'
import toast from 'react-hot-toast'

const TICKET_STATUSES = ['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed']

function SLACountdown({ dueDate, label }) {
  const [countdown, setCountdown] = useState(null)
  useEffect(() => {
    if (!dueDate) return
    const calc = () => {
      const diff = new Date(dueDate) - new Date()
      if (diff <= 0) {
        const over = Math.abs(diff)
        setCountdown({ text: `${Math.floor(over / 3600000)}h ${Math.floor((over % 3600000) / 60000)}m overdue`, overdue: true })
      } else {
        setCountdown({ text: `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m remaining`, overdue: false })
      }
    }
    calc()
    const iv = setInterval(calc, 60000)
    return () => clearInterval(iv)
  }, [dueDate])
  if (!countdown) return null
  return (
    <div className={`flex items-center gap-1.5 text-xs font-mono mt-1 ${countdown.overdue ? 'text-cortex-critical' : 'text-cortex-muted'}`}>
      <Clock className="w-3 h-3" />
      <span>{label}: {countdown.overdue ? '⚠ ' : '⏱ '}{countdown.text}</span>
    </div>
  )
}

const ALERTS_PREVIEW = 3
const NOTES_PREVIEW = 3

export default function TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [showSimilar, setShowSimilar] = useState(true)

  // Collapse state
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [showAllNotes, setShowAllNotes] = useState(false)
  const [threadExpanded, setThreadExpanded] = useState(false)
  const [showStatusDrop, setShowStatusDrop] = useState(false)
  const [showAssignDrop, setShowAssignDrop] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    refetchInterval: 30000,
  })

  const { data: similarTickets = [] } = useQuery({
    queryKey: ['similar', ticketId],
    queryFn: () => getSimilarTickets(ticketId),
    enabled: !!ticketId,
  })

  const holdMutation = useMutation({
    mutationFn: ({ action }) => holdTicket(ticketId, action),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success(`SLA ${action === 'pause' ? 'paused' : 'resumed'}`)
    },
    onError: (err) => toast.error(err.message || 'Operation failed'),
  })

  const handleAskAI = () => {
    if (!data?.ticket) return
    const t = data.ticket
    openCompanionWith(`What is the full history of ticket ${t.clickup_task_id || `#${t.id}`}?`)
  }

  const handleAddNote = async () => {
    if (!noteContent.trim()) return
    setAddingNote(true)
    try {
      await addTicketNote(ticketId, { content: noteContent })
      setNoteContent('')
      setShowNoteForm(false)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Note added')
    } catch (e) {
      toast.error(e.message || 'Failed to add note')
    } finally {
      setAddingNote(false)
    }
  }

  async function handleStatusChange(newStatus) {
    setChangingStatus(true)
    setShowStatusDrop(false)
    try {
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success(`Status updated to ${newStatus}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update status')
    } finally {
      setChangingStatus(false)
    }
  }

  async function handleEscalate() {
    if (!confirm('Escalate this ticket one level?')) return
    setEscalating(true)
    try {
      await fetch(`/api/tickets/${ticketId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual escalation by admin' }),
      })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Ticket escalated')
    } catch (err) {
      toast.error(err.message || 'Failed to escalate')
    } finally {
      setEscalating(false)
    }
  }

  async function handleAssign(agentId, agentEmail) {
    setAssigning(true)
    setShowAssignDrop(false)
    try {
      await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to_id: agentId, assigned_to_email: agentEmail }),
      })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success(agentEmail ? `Ticket assigned to ${agentEmail.split('@')[0]}` : 'Ticket unassigned')
    } catch (err) {
      toast.error(err.message || 'Failed to assign ticket')
    } finally {
      setAssigning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-12 bg-cortex-surface animate-pulse rounded-xl" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-cortex-surface animate-pulse rounded-xl" />)}
        </div>
        <div className="h-96 bg-cortex-surface animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-16 h-16 mx-auto mb-4 text-cortex-danger" />
        <h2 className="text-2xl font-bold mb-2">Ticket Not Found</h2>
        <p className="text-cortex-muted mb-6">The ticket you are looking for does not exist.</p>
        <Link href="/tickets" className="btn-primary">Back to Tickets</Link>
      </div>
    )
  }

  const { ticket, threads, alerts } = data
  const isPaused = !!ticket.sla_paused_at
  const isActive = !['closed', 'resolved', 'complete', 'Closed', 'Resolved'].includes(ticket.status)
  const internalNotes = (threads || []).filter(t => t.action_type === 'internal_note')
  const publicThreads = (threads || []).filter(t => t.action_type !== 'internal_note')

  // Sliced views
  const visibleAlerts = showAllAlerts ? (alerts || []) : (alerts || []).slice(0, ALERTS_PREVIEW)
  const visibleNotes = showAllNotes ? internalNotes : internalNotes.slice(0, NOTES_PREVIEW)
  const hiddenAlerts = (alerts || []).length - ALERTS_PREVIEW
  const hiddenNotes = internalNotes.length - NOTES_PREVIEW

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/tickets" className="btn-secondary mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-sm text-cortex-muted font-mono">{ticket.clickup_task_id}</span>
            {ticket.clickup_url && (
              <a href={ticket.clickup_url} target="_blank" rel="noopener noreferrer"
                className="text-cortex-accent hover:underline text-sm flex items-center gap-1">
                Open in ClickUp <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={handleAskAI}
              className="flex items-center gap-1.5 text-xs bg-cortex-accent/10 text-cortex-accent hover:bg-cortex-accent/20 px-3 py-1 rounded-full transition-colors"
            >
              <Bot className="w-3.5 h-3.5" /> Ask AI
            </button>
            {isActive && (
              <button
                onClick={() => holdMutation.mutate({ action: isPaused ? 'resume' : 'pause' })}
                disabled={holdMutation.isPending}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full transition-colors ${
                  isPaused
                    ? 'bg-cortex-success/10 text-cortex-success hover:bg-cortex-success/20'
                    : 'bg-cortex-warning/10 text-cortex-warning hover:bg-cortex-warning/20'
                }`}
              >
                {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                {isPaused ? 'Resume SLA' : 'Pause SLA'}
              </button>
            )}

            {/* ── Admin actions ── */}
            {isAdmin && (
              <>
                {/* Status change */}
                <div className="relative">
                  <button
                    onClick={() => { setShowStatusDrop(s => !s); setShowAssignDrop(false) }}
                    disabled={changingStatus}
                    className="flex items-center gap-1.5 text-xs bg-cortex-surface border border-cortex-border hover:border-cortex-accent px-3 py-1 rounded-full transition-colors text-cortex-text"
                  >
                    {changingStatus
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />}
                    {ticket.status}
                  </button>
                  {showStatusDrop && (
                    <div className="absolute top-full left-0 mt-1.5 bg-cortex-surface border border-cortex-border rounded-xl shadow-card-hover z-20 py-1 min-w-[140px] overflow-hidden">
                      {TICKET_STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-cortex-surface-raised transition-colors ${s === ticket.status ? 'text-cortex-accent' : 'text-cortex-text'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Escalate */}
                <button
                  onClick={handleEscalate}
                  disabled={escalating}
                  className="flex items-center gap-1.5 text-xs bg-cortex-warning/10 text-cortex-warning hover:bg-cortex-warning/20 px-3 py-1 rounded-full transition-colors"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  {escalating ? 'Escalating…' : 'Escalate'}
                </button>

                {/* Re-assign */}
                <div className="relative">
                  <button
                    onClick={() => { setShowAssignDrop(s => !s); setShowStatusDrop(false) }}
                    disabled={assigning}
                    className="flex items-center gap-1.5 text-xs bg-cortex-accent/10 text-cortex-accent hover:bg-cortex-accent/20 px-3 py-1 rounded-full transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {ticket.assigned_to_email ? `→ ${ticket.assigned_to_email.split('@')[0]}` : 'Assign'}
                  </button>
                  {showAssignDrop && (
                    <AssignDropdown ticketId={ticketId} onAssign={handleAssign} onClose={() => setShowAssignDrop(false)} />
                  )}
                </div>
              </>
            )}
          </div>
          <h1 className="text-2xl font-display font-bold">{ticket.title}</h1>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
        <span className={`badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
        <span className={`badge ${getSLAStatusColor(ticket.sla_status)}`}>
          SLA: {ticket.sla_paused_at ? 'paused' : ticket.sla_status}
        </span>
        {ticket.escalation_level > 0 && (
          <span className={`badge ${getEscalationLevelColor(ticket.escalation_level)}`}>
            Escalation L{ticket.escalation_level}
          </span>
        )}
        {ticket.ai_sentiment && (
          <span className="badge bg-cortex-surface">{getSentimentEmoji(ticket.ai_sentiment)} {ticket.ai_sentiment}</span>
        )}
        {ticket.request_type && <span className="badge bg-cortex-surface">{ticket.request_type}</span>}
      </div>

      {/* Key Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-cortex-accent" />
            <h3 className="font-semibold">Reporter</h3>
          </div>
          <p className="font-medium">{ticket.poc_name || ticket.created_by_name || 'Unknown'}</p>
          <p className="text-sm text-cortex-muted">{ticket.poc_email || ticket.created_by_email}</p>
          {ticket.poc_phone && <p className="text-sm text-cortex-muted font-mono mt-1">{ticket.poc_phone}</p>}
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
                      ticket.sla_consumption_pct >= 50 ? 'bg-cortex-warning' : 'bg-cortex-success'
                    }`}
                    style={{ width: `${Math.min(ticket.sla_consumption_pct || 0, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-bold">{ticket.sla_consumption_pct || 0}%</span>
              </div>
            </div>
            {ticket.sla_resolution_due && (
              <div>
                <p className="text-xs text-cortex-muted">Resolution Due</p>
                <p className="text-sm font-mono">{formatDate(ticket.sla_resolution_due)}</p>
                {!isPaused && <SLACountdown dueDate={ticket.sla_resolution_due} label="Resolution" />}
              </div>
            )}
            {ticket.sla_response_due && !isPaused && (
              <SLACountdown dueDate={ticket.sla_response_due} label="Response" />
            )}
            {isPaused && (
              <p className="text-xs text-blue-500">SLA paused since {formatDate(ticket.sla_paused_at)}</p>
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
              <span className="text-sm font-bold">{publicThreads.length}</span>
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

      {/* ── Escalation Alerts (top 3, rest hidden) ─────────────────────────── */}
      {alerts && alerts.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-cortex-danger" />
              <h3 className="font-semibold">Escalation Alerts</h3>
              <span className="badge text-xs">{alerts.length}</span>
            </div>
            {alerts.length > ALERTS_PREVIEW && (
              <button
                onClick={() => setShowAllAlerts(v => !v)}
                className="flex items-center gap-1 text-xs text-cortex-muted hover:text-cortex-accent transition-colors"
              >
                {showAllAlerts ? (
                  <><Minimize2 className="w-3.5 h-3.5" /> Show less</>
                ) : (
                  <><ChevronDown className="w-3.5 h-3.5" /> +{hiddenAlerts} more</>
                )}
              </button>
            )}
          </div>
          <div className="space-y-3">
            {visibleAlerts.map(alert => (
              <div key={alert.id} className="p-3 bg-cortex-bg rounded-xl border border-cortex-border">
                <div className="flex items-center justify-between mb-2">
                  <span className={`badge ${getEscalationLevelColor(alert.alert_level)}`}>Level {alert.alert_level}</span>
                  <span className="text-xs text-cortex-muted font-mono">{formatRelativeTime(alert.created_at)}</span>
                </div>
                <p className="text-sm text-cortex-muted">Consumption: {alert.consumption_pct}%</p>
                {alert.notified_emails?.length > 0 && (
                  <p className="text-xs text-cortex-muted mt-2">Notified: {alert.notified_emails.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
          {alerts.length > ALERTS_PREVIEW && !showAllAlerts && (
            <button
              onClick={() => setShowAllAlerts(true)}
              className="mt-3 w-full text-xs text-cortex-muted hover:text-cortex-accent border border-dashed border-cortex-border rounded-lg py-2 transition-colors"
            >
              Show all {alerts.length} alerts
            </button>
          )}
        </div>
      )}

      {/* ── Internal Notes (top 3, rest hidden) ────────────────────────────── */}
      <div className="card border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            Internal Notes
            {internalNotes.length > 0 && (
              <span className="badge text-xs">{internalNotes.length}</span>
            )}
          </h3>
          <div className="flex items-center gap-3">
            {internalNotes.length > NOTES_PREVIEW && (
              <button
                onClick={() => setShowAllNotes(v => !v)}
                className="flex items-center gap-1 text-xs text-cortex-muted hover:text-amber-500 transition-colors"
              >
                {showAllNotes ? (
                  <><Minimize2 className="w-3.5 h-3.5" /> Show less</>
                ) : (
                  <><Maximize2 className="w-3.5 h-3.5" /> +{hiddenNotes} more</>
                )}
              </button>
            )}
            <button
              onClick={() => setShowNoteForm(v => !v)}
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Note
            </button>
          </div>
        </div>

        {showNoteForm && (
          <div className="mb-4 space-y-2">
            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Write an internal note visible only to the support team..."
              className="input w-full min-h-[80px] resize-y text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddNote}
                disabled={addingNote || !noteContent.trim()}
                className="btn-primary text-sm py-1.5"
              >
                {addingNote ? 'Saving...' : 'Save Note'}
              </button>
              <button onClick={() => setShowNoteForm(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
            </div>
          </div>
        )}

        {internalNotes.length > 0 ? (
          <>
            <div className="space-y-3">
              {visibleNotes.map(note => (
                <div key={note.id} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{note.actor_name}</span>
                    <span className="text-xs text-cortex-muted font-mono">{formatDate(note.created_at)}</span>
                  </div>
                  <p className="text-sm text-cortex-text">{note.raw_content}</p>
                </div>
              ))}
            </div>
            {internalNotes.length > NOTES_PREVIEW && !showAllNotes && (
              <button
                onClick={() => setShowAllNotes(true)}
                className="mt-3 w-full text-xs text-cortex-muted hover:text-amber-500 border border-dashed border-amber-500/20 rounded-lg py-2 transition-colors"
              >
                Show all {internalNotes.length} notes
              </button>
            )}
          </>
        ) : (
          !showNoteForm && <p className="text-xs text-cortex-muted text-center py-3">No internal notes yet</p>
        )}
      </div>

      {/* ── Activity Thread (minimized timeline → expand to full) ───────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cortex-muted" />
            Activity Thread
            {publicThreads.length > 0 && (
              <span className="badge text-xs">{publicThreads.length}</span>
            )}
          </h3>
          {publicThreads.length > 0 && (
            <button
              onClick={() => setThreadExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs text-cortex-muted hover:text-cortex-accent border border-cortex-border rounded-lg px-2.5 py-1.5 transition-colors"
            >
              {threadExpanded ? (
                <><Minimize2 className="w-3.5 h-3.5" /> Collapse</>
              ) : (
                <><Maximize2 className="w-3.5 h-3.5" /> Expand all</>
              )}
            </button>
          )}
        </div>

        {publicThreads.length > 0 ? (
          threadExpanded ? (
            /* ── Full expanded view ── */
            <div className="space-y-4">
              {publicThreads.map(thread => (
                <div key={thread.id} className="relative pl-6 pb-6 border-l-2 border-cortex-border last:pb-0">
                  <div className="absolute left-0 top-0 w-2 h-2 -translate-x-[5px] rounded-full bg-cortex-accent" />
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{thread.actor_name || 'System'}</span>
                          <span className="badge bg-cortex-surface text-xs">{thread.action_type?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-xs text-cortex-muted font-mono">{formatDate(thread.created_at)}</p>
                      </div>
                    </div>
                    {thread.raw_content && (
                      <p className="text-sm text-cortex-text bg-cortex-bg p-3 rounded">{thread.raw_content}</p>
                    )}
                    {thread.ai_summary && (
                      <p className="text-sm text-cortex-accent bg-cortex-accent/5 p-3 rounded">✨ {thread.ai_summary}</p>
                    )}
                    {thread.has_attachments && <span className="text-xs text-cortex-muted">📎 Has attachments</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Minimized vertical timeline ── */
            <div className="space-y-0 border border-cortex-border rounded-xl overflow-hidden">
              {publicThreads.map((thread, idx) => (
                <div
                  key={thread.id}
                  className={`flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-cortex-bg/60 transition-colors ${
                    idx !== publicThreads.length - 1 ? 'border-b border-cortex-border/50' : ''
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-cortex-accent shrink-0" />
                  <span className="font-medium text-cortex-text w-28 shrink-0 truncate">
                    {thread.actor_name || 'System'}
                  </span>
                  <span className="badge bg-cortex-surface text-xs shrink-0">
                    {thread.action_type?.replace(/_/g, ' ')}
                  </span>
                  {thread.raw_content && (
                    <span className="text-cortex-muted flex-1 truncate hidden sm:block">
                      {thread.raw_content}
                    </span>
                  )}
                  <span className="text-cortex-muted font-mono shrink-0 ml-auto">
                    {formatRelativeTime(thread.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <p className="text-center py-8 text-cortex-muted">No activity recorded</p>
        )}
      </div>

      {/* Similar Resolved Tickets */}
      {similarTickets.length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowSimilar(v => !v)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-cortex-muted" />
              Similar Resolved Tickets
              <span className="badge text-xs">{similarTickets.length}</span>
            </h3>
            {showSimilar ? <ChevronUp className="w-4 h-4 text-cortex-muted" /> : <ChevronDown className="w-4 h-4 text-cortex-muted" />}
          </button>
          {showSimilar && (
            <div className="mt-4 space-y-2">
              {similarTickets.map(t => (
                <Link
                  key={t.id}
                  href={`/tickets/${t.id}`}
                  className="flex items-center justify-between p-3 bg-cortex-bg rounded-xl hover:bg-cortex-surface-raised transition-colors border border-cortex-border"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium text-cortex-text truncate">{t.title}</p>
                    <p className="text-xs text-cortex-muted mt-0.5">{t.module} · {t.request_type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge text-xs ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                    <span className="text-xs text-cortex-muted font-mono">{t.resolved_at ? formatRelativeTime(t.resolved_at) : ''}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Additional Details */}
      {(ticket.module || ticket.operating_system || ticket.mobile_or_national_id) && (
        <div className="card">
          <h3 className="font-semibold mb-4">Additional Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ticket.module && <div><p className="text-xs text-cortex-muted mb-1">Module</p><p className="text-sm font-medium">{ticket.module}</p></div>}
            {ticket.operating_system && <div><p className="text-xs text-cortex-muted mb-1">OS</p><p className="text-sm font-medium">{ticket.operating_system}</p></div>}
            {ticket.mobile_or_national_id && <div><p className="text-xs text-cortex-muted mb-1">Patient ID</p><p className="text-sm font-mono">{ticket.mobile_or_national_id}</p></div>}
            {ticket.case_type && <div><p className="text-xs text-cortex-muted mb-1">Case Type</p><p className="text-sm font-medium">{ticket.case_type}</p></div>}
          </div>
        </div>
      )}
    </div>
  )
}

function AssignDropdown({ onAssign, onClose }) {
  const { data: agents = [] } = useQuery({
    queryKey: ['agent-list-assign'],
    queryFn: () => getUsers().then(u => u.filter(x => x.role === 'agent' && x.is_active)),
    staleTime: 300000,
  })

  return (
    <div className="absolute top-full left-0 mt-1.5 bg-cortex-surface border border-cortex-border rounded-xl shadow-card-hover z-20 py-1 min-w-[180px] max-h-48 overflow-y-auto">
      {agents.length === 0 ? (
        <p className="px-4 py-2 text-xs text-cortex-muted">No agents found</p>
      ) : (
        <>
          <button
            onClick={() => { onAssign(null, null); onClose() }}
            className="w-full text-left px-4 py-2 text-sm text-cortex-muted hover:bg-cortex-bg transition-colors"
          >
            Unassign
          </button>
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => { onAssign(a.id, a.email); onClose() }}
              className="w-full text-left px-4 py-2 text-sm text-cortex-text hover:bg-cortex-bg transition-colors"
            >
              <div className="font-medium">{a.full_name}</div>
              <div className="text-xs text-cortex-muted">{a.email}</div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
