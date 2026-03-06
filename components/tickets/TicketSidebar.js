'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTicket, holdTicket, getUsers } from '@/lib/api'
import { getSLAStatusColor, getPriorityColor, getStatusColor, formatDate, formatRelativeTime } from '@/lib/utils'
import {
  Clock, User, ChevronDown, RefreshCw, ArrowUpCircle, UserCheck,
  PauseCircle, PlayCircle, BarChart2, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TICKET_STATUSES = ['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed']
const TICKET_PRIORITIES = ['P1', 'P2', 'P3', 'P4']

function SLACountdown({ dueDate }) {
  const [countdown, setCountdown] = useState(null)
  useEffect(() => {
    if (!dueDate) return
    const calc = () => {
      const diff = new Date(dueDate) - new Date()
      if (diff <= 0) {
        const over = Math.abs(diff)
        setCountdown({ text: `${Math.floor(over / 3600000)}h ${Math.floor((over % 3600000) / 60000)}m overdue`, overdue: true })
      } else {
        setCountdown({ text: `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m left`, overdue: false })
      }
    }
    calc()
    const iv = setInterval(calc, 60000)
    return () => clearInterval(iv)
  }, [dueDate])
  if (!countdown) return null
  return (
    <span className={`font-mono text-xs ${countdown.overdue ? 'text-cortex-critical' : 'text-cortex-muted'}`}>
      {countdown.overdue ? '⚠ ' : '⏱ '}{countdown.text}
    </span>
  )
}

export default function TicketSidebar({ ticketId, onTicketUpdated }) {
  const queryClient = useQueryClient()
  const [showStatusDrop, setShowStatusDrop] = useState(false)
  const [showPriorityDrop, setShowPriorityDrop] = useState(false)
  const [showAssignDrop, setShowAssignDrop] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [changingPriority, setChangingPriority] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    refetchInterval: 30000,
    enabled: !!ticketId,
  })

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 300000,
  })

  const holdMutation = useMutation({
    mutationFn: ({ action }) => holdTicket(ticketId, action),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success(`SLA ${action === 'pause' ? 'paused' : 'resumed'}`)
    },
    onError: (err) => toast.error(err.message || 'Operation failed'),
  })

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
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      onTicketUpdated?.()
      toast.success(`Status → ${newStatus}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update status')
    } finally {
      setChangingStatus(false)
    }
  }

  async function handlePriorityChange(newPriority) {
    setChangingPriority(true)
    setShowPriorityDrop(false)
    try {
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success(`Priority → ${newPriority}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update priority')
    } finally {
      setChangingPriority(false)
    }
  }

  async function handleEscalate() {
    if (!confirm('Escalate this ticket one level?')) return
    setEscalating(true)
    try {
      await fetch(`/api/tickets/${ticketId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual escalation by agent' }),
      })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Ticket escalated')
    } catch (err) {
      toast.error(err.message || 'Failed to escalate')
    } finally {
      setEscalating(false)
    }
  }

  async function handleAssign(userId, userEmail) {
    setAssigning(true)
    setShowAssignDrop(false)
    try {
      await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to_id: userId, assigned_to_email: userEmail }),
      })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success(userEmail ? `Assigned to ${userEmail.split('@')[0]}` : 'Unassigned')
    } catch (err) {
      toast.error(err.message || 'Failed to assign ticket')
    } finally {
      setAssigning(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-cortex-bg animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  const { ticket } = data
  const isPaused = !!ticket.sla_paused_at
  const isActive = !['closed', 'resolved', 'complete', 'Closed', 'Resolved'].includes(ticket.status)
  const slaPct = Math.min(ticket.sla_consumption_pct || 0, 100)

  return (
    <div className="space-y-3">

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
        <span className={`badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
        <span className={`badge ${getSLAStatusColor(ticket.sla_status)}`}>
          SLA: {isPaused ? 'paused' : ticket.sla_status}
        </span>
        {ticket.clickup_url && (
          <a href={ticket.clickup_url} target="_blank" rel="noopener noreferrer"
            className="badge bg-cortex-surface border border-cortex-border text-cortex-muted hover:text-cortex-accent transition-colors flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> ClickUp
          </a>
        )}
      </div>

      {/* Action toolbar */}
      <div className="rounded-2xl border border-cortex-border bg-cortex-surface px-3 py-2.5 flex flex-col gap-2">
        <p className="text-[10px] text-cortex-muted uppercase tracking-wider font-semibold">Quick Actions</p>
        <div className="flex flex-wrap gap-1.5">

          {/* Status */}
          <div className="relative">
            <button
              onClick={() => { setShowStatusDrop(s => !s); setShowAssignDrop(false); setShowPriorityDrop(false) }}
              disabled={changingStatus}
              className="flex items-center gap-1.5 text-xs bg-cortex-bg border border-cortex-border hover:border-cortex-accent px-2.5 py-1.5 rounded-lg transition-colors text-cortex-text font-medium"
            >
              {changingStatus ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 text-cortex-muted" />}
              {ticket.status}
              <ChevronDown className="w-3 h-3 text-cortex-muted" />
            </button>
            {showStatusDrop && (
              <div className="absolute top-full left-0 mt-1 bg-cortex-surface border border-cortex-border rounded-xl shadow-lg z-30 py-1 min-w-[140px] overflow-hidden">
                {TICKET_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-cortex-surface-raised transition-colors ${s === ticket.status ? 'text-cortex-accent' : 'text-cortex-text'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="relative">
            <button
              onClick={() => { setShowPriorityDrop(s => !s); setShowStatusDrop(false); setShowAssignDrop(false) }}
              disabled={changingPriority}
              className="flex items-center gap-1.5 text-xs bg-cortex-bg border border-cortex-border hover:border-cortex-accent px-2.5 py-1.5 rounded-lg transition-colors text-cortex-text font-medium"
            >
              {ticket.priority || 'Priority'}
              <ChevronDown className="w-3 h-3 text-cortex-muted" />
            </button>
            {showPriorityDrop && (
              <div className="absolute top-full left-0 mt-1 bg-cortex-surface border border-cortex-border rounded-xl shadow-lg z-30 py-1 min-w-[90px] overflow-hidden">
                {TICKET_PRIORITIES.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-cortex-surface-raised transition-colors ${p === ticket.priority ? 'text-cortex-accent' : 'text-cortex-text'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Escalate */}
          <button
            onClick={handleEscalate}
            disabled={escalating}
            className="flex items-center gap-1.5 text-xs bg-cortex-warning/10 text-cortex-warning hover:bg-cortex-warning/20 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
          >
            <ArrowUpCircle className="w-3 h-3" />
            {escalating ? '…' : 'Escalate'}
          </button>

          {/* SLA pause */}
          {isActive && (
            <button
              onClick={() => holdMutation.mutate({ action: isPaused ? 'resume' : 'pause' })}
              disabled={holdMutation.isPending}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium ${
                isPaused ? 'bg-cortex-success/10 text-cortex-success' : 'bg-cortex-warning/10 text-cortex-warning'
              }`}
            >
              {isPaused ? <PlayCircle className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
              {isPaused ? 'Resume' : 'Pause SLA'}
            </button>
          )}

          {/* Assign */}
          <div className="relative">
            <button
              onClick={() => { setShowAssignDrop(s => !s); setShowStatusDrop(false); setShowPriorityDrop(false) }}
              disabled={assigning}
              className="flex items-center gap-1.5 text-xs bg-cortex-accent/10 text-cortex-accent hover:bg-cortex-accent/20 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
            >
              <UserCheck className="w-3 h-3" />
              {ticket.assigned_to_email ? ticket.assigned_to_email.split('@')[0] : 'Assign'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showAssignDrop && (
              <div className="absolute top-full left-0 mt-1 bg-cortex-surface border border-cortex-border rounded-xl shadow-lg z-30 py-1 min-w-[160px] max-h-48 overflow-y-auto">
                <button
                  onClick={() => handleAssign(null, null)}
                  className="w-full text-left px-3 py-2 text-xs text-cortex-muted hover:bg-cortex-surface-raised transition-colors"
                >
                  Unassign
                </button>
                {allUsers.filter(u => u.is_active !== false).map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleAssign(u.id, u.email)}
                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-cortex-surface-raised transition-colors ${u.email === ticket.assigned_to_email ? 'text-cortex-accent' : 'text-cortex-text'}`}
                  >
                    {u.full_name || u.email.split('@')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* SLA Status */}
      <div className="rounded-2xl border border-cortex-border bg-cortex-surface overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cortex-border/40">
          <Clock className="w-4 h-4 text-cortex-warning" />
          <span className="text-sm font-semibold text-cortex-text">SLA Status</span>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-cortex-muted">Consumption</span>
              <span className="text-xs font-mono font-bold">{slaPct}%</span>
            </div>
            <div className="h-1.5 bg-cortex-bg rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  slaPct >= 90 ? 'bg-cortex-critical' :
                  slaPct >= 75 ? 'bg-cortex-danger' :
                  slaPct >= 50 ? 'bg-cortex-warning' : 'bg-cortex-success'
                }`}
                style={{ width: `${slaPct}%` }}
              />
            </div>
          </div>
          {ticket.sla_resolution_due && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-cortex-muted">Resolution due</span>
              <div className="text-right">
                <p className="text-xs font-mono">{formatDate(ticket.sla_resolution_due)}</p>
                {!isPaused && <SLACountdown dueDate={ticket.sla_resolution_due} />}
              </div>
            </div>
          )}
          {isPaused && (
            <p className="text-xs text-blue-500">Paused since {formatDate(ticket.sla_paused_at)}</p>
          )}
        </div>
      </div>

      {/* Reporter */}
      <div className="rounded-2xl border border-cortex-border bg-cortex-surface overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cortex-border/40">
          <User className="w-4 h-4 text-cortex-muted" />
          <span className="text-sm font-semibold text-cortex-text">Reporter</span>
        </div>
        <div className="px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-cortex-text flex items-center gap-1.5">
            {ticket.poc_name || ticket.created_by_name || 'Unknown'}
            {ticket.poc_is_vip && <span title="VIP">⭐</span>}
          </p>
          <p className="text-xs text-cortex-muted">{ticket.poc_email || ticket.created_by_email || '—'}</p>
          {ticket.poc_phone && <p className="text-xs text-cortex-muted font-mono">{ticket.poc_phone}</p>}
          {ticket.company_name && (
            <p className="text-xs text-cortex-muted mt-0.5">{ticket.company_name}</p>
          )}
        </div>
      </div>

      {/* Activity timestamps */}
      <div className="rounded-2xl border border-cortex-border bg-cortex-surface overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cortex-border/40">
          <BarChart2 className="w-4 h-4 text-cortex-muted" />
          <span className="text-sm font-semibold text-cortex-text">Activity</span>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-cortex-muted">Created</span>
            <span className="text-xs font-mono">{formatRelativeTime(ticket.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-cortex-muted">Updated</span>
            <span className="text-xs font-mono">{formatRelativeTime(ticket.updated_at)}</span>
          </div>
          {ticket.module && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-cortex-muted">Module</span>
              <span className="text-xs text-cortex-text">{ticket.module}</span>
            </div>
          )}
          {ticket.request_type && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-cortex-muted">Request Type</span>
              <span className="text-xs text-cortex-text">{ticket.request_type}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
