'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTicket, getSimilarTickets, addTicketNote, holdTicket, getUsers, flagTicket, unflagTicket } from '@/lib/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
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
  History,
  ArrowUpCircle,
  UserCheck,
  RefreshCw,
  AlignLeft,
  Sparkles,
  Tag,
  BarChart2,
  Pencil,
  Trash2,
  AtSign,
  Flag,
  Mail,
  Send,
  Link2,
} from 'lucide-react'
import { openCompanionWith } from '@/components/ui/AICompanion'
import NewBadge from '@/components/ui/NewBadge'
import toast from 'react-hot-toast'

const TICKET_STATUSES = ['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed']
const TICKET_PRIORITIES = ['P1', 'P2', 'P3', 'P4']

/* ── Collapsible section wrapper ────────────────────────────────────── */
function Section({ title, icon: Icon, iconClass, badge, defaultOpen = true, className, headerRight, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`rounded-2xl border overflow-hidden ${className || 'border-cortex-border bg-cortex-surface'}`}
      style={{ boxShadow: '0 1px 3px rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.02)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-cortex-surface-raised transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${iconClass || 'text-cortex-muted'}`} />}
          <span className="text-sm font-semibold text-cortex-text">{title}</span>
          {badge != null && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cortex-bg border border-cortex-border text-cortex-muted">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {headerRight && (
            <div onClick={e => e.stopPropagation()} className="flex items-center gap-2">
              {headerRight}
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-cortex-muted transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-cortex-border/40 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Live SLA countdown ─────────────────────────────────────────────── */
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

/* ── Thread source badge ─────────────────────────────────────────────── */
function ThreadSourceBadge({ thread }) {
  const src = thread.thread_source
  if (!src || src === 'internal') return null
  if (src === 'clickup') {
    return <span className="badge text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-500">ClickUp</span>
  }
  if (src === 'zoho') {
    return <span className="badge text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-500">Zoho</span>
  }
  if (src === 'linked_clickup_task') {
    let taskName = ''
    try { taskName = JSON.parse(thread.metadata || '{}').linked_task_name || '' } catch {}
    return <span className="badge text-[10px] bg-purple-500/10 border-purple-500/30 text-purple-500">Linked{taskName ? `: ${taskName.substring(0, 20)}` : ' Task'}</span>
  }
  if (src === 'linked_email') {
    return <span className="badge text-[10px] bg-orange-500/10 border-orange-500/30 text-orange-500">Linked Email</span>
  }
  return null
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [cuComment, setCuComment] = useState('')
  const [addingCuComment, setAddingCuComment] = useState(false)
  const [showCuCommentForm, setShowCuCommentForm] = useState(false)
  const [showAllNotes, setShowAllNotes] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionDrop, setShowMentionDrop] = useState(false)
  const [mentionCursorAt, setMentionCursorAt] = useState(0)
  const noteTextareaRef = useRef(null)
  const [showAllAlerts, setShowAllAlerts] = useState(false)
  const [threadExpanded, setThreadExpanded] = useState(false)
  const [threadOrder, setThreadOrder] = useState('asc')
  const [showStatusDrop, setShowStatusDrop] = useState(false)
  const [showPriorityDrop, setShowPriorityDrop] = useState(false)
  const [showAssignDrop, setShowAssignDrop] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [changingPriority, setChangingPriority] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [showEscalateModal, setShowEscalateModal] = useState(false)
  const [escalateLevel, setEscalateLevel] = useState('1')
  const [escalateReason, setEscalateReason] = useState('')
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagging, setFlagging] = useState(false)
  const [zohoIdInput, setZohoIdInput] = useState('')
  const [savingZohoId, setSavingZohoId] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkSearchQuery, setLinkSearchQuery] = useState('')
  const [linkSearchResults, setLinkSearchResults] = useState([])
  const [linkSearching, setLinkSearching] = useState(false)
  const [linkingTicket, setLinkingTicket] = useState(false)

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

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-mention'],
    queryFn: () => getUsers().then(u => u.filter(x => x.is_active)),
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

  const handleAskAI = () => {
    if (!data?.ticket) return
    const t = data.ticket
    openCompanionWith(`What is the full history of ticket ${t.clickup_task_id || `#${t.id}`}?`)
  }

  const handleLinkSearch = async (q) => {
    if (!q.trim()) { setLinkSearchResults([]); return }
    setLinkSearching(true)
    try {
      const res = await fetch(`/api/tickets?search=${encodeURIComponent(q)}&limit=10`)
      const d = await res.json()
      setLinkSearchResults((d.tickets || []).filter(t => String(t.id) !== String(ticketId)))
    } catch { setLinkSearchResults([]) }
    setLinkSearching(false)
  }

  const handleLinkAsThread = async (sourceTicketId) => {
    setLinkingTicket(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/link-as-thread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_ticket_id: sourceTicketId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Email linked as thread')
      setShowLinkModal(false)
      setLinkSearchQuery('')
      setLinkSearchResults([])
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLinkingTicket(false)
    }
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

  const handleNoteChange = (e) => {
    const val = e.target.value
    setNoteContent(val)
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const atIdx = before.lastIndexOf('@')
    if (atIdx !== -1 && !before.slice(atIdx + 1).includes(' ')) {
      setMentionQuery(before.slice(atIdx + 1))
      setMentionCursorAt(atIdx)
      setShowMentionDrop(true)
    } else {
      setShowMentionDrop(false)
    }
  }

  const insertMention = (user) => {
    const before = noteContent.slice(0, mentionCursorAt)
    const after = noteContent.slice(mentionCursorAt + 1 + mentionQuery.length)
    setNoteContent(`${before}@${user.full_name}${after} `)
    setShowMentionDrop(false)
    setTimeout(() => noteTextareaRef.current?.focus(), 0)
  }

  const handleEditNote = async (noteId) => {
    if (!editContent.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setEditingNoteId(null)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Note updated')
    } catch (e) {
      toast.error(e.message || 'Failed to update note')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return
    try {
      const res = await fetch(`/api/tickets/${ticketId}/notes/${noteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Note deleted')
    } catch (e) {
      toast.error(e.message || 'Failed to delete note')
    }
  }

  const handleAddClickUpComment = async () => {
    if (!cuComment.trim()) return
    setAddingCuComment(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/clickup-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cuComment }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      setCuComment('')
      setShowCuCommentForm(false)
      toast.success('Comment posted to ClickUp')
    } catch (e) {
      toast.error(e.message || 'Failed to post ClickUp comment')
    } finally {
      setAddingCuComment(false)
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
    setShowEscalateModal(true)
    setEscalateLevel('1')
    setEscalateReason('')
  }

  async function submitEscalation() {
    if (!escalateReason.trim()) return
    setEscalating(true)
    try {
      await fetch(`/api/tickets/${ticketId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: parseInt(escalateLevel), reason: escalateReason.trim() }),
      })
      await addTicketNote(ticketId, { content: `Escalation reason (L${escalateLevel}): ${escalateReason.trim()}` })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success(`Escalated to Level ${escalateLevel}`)
      setShowEscalateModal(false)
    } catch (err) {
      toast.error(err.message || 'Failed to escalate')
    } finally {
      setEscalating(false)
    }
  }

  async function handleFlagSubmit() {
    if (!flagReason.trim()) return
    setFlagging(true)
    try {
      await flagTicket(ticketId, flagReason.trim())
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Ticket flagged for QA review')
      setShowFlagModal(false)
      setFlagReason('')
    } catch (e) {
      toast.error(e.message || 'Failed to flag ticket')
    } finally {
      setFlagging(false)
    }
  }

  async function handleUnflag() {
    setFlagging(true)
    try {
      await unflagTicket(ticketId)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Flag removed')
    } catch (e) {
      toast.error(e.message || 'Failed to remove flag')
    } finally {
      setFlagging(false)
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
      toast.success(agentEmail ? `Assigned to ${agentEmail.split('@')[0]}` : 'Unassigned')
    } catch (err) {
      toast.error(err.message || 'Failed to assign ticket')
    } finally {
      setAssigning(false)
    }
  }

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="max-w-screen-xl mx-auto space-y-5 animate-fade-in">
        <div className="h-5 w-48 bg-cortex-surface rounded animate-pulse" />
        <div className="h-10 w-2/3 bg-cortex-surface rounded animate-pulse" />
        <div className="h-12 bg-cortex-surface rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-cortex-surface rounded-2xl animate-pulse" />)}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-cortex-surface rounded-2xl animate-pulse" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-screen-xl mx-auto text-center py-20">
        <XCircle className="w-14 h-14 mx-auto mb-4 text-cortex-danger" />
        <h2 className="text-xl font-bold mb-2">Ticket Not Found</h2>
        <p className="text-cortex-muted text-sm mb-6">The ticket you are looking for does not exist.</p>
        <Link href="/tickets" className="btn-primary">Back to Tickets</Link>
      </div>
    )
  }

  const { ticket, threads, alerts } = data
  const isPaused = !!ticket.sla_paused_at
  const isActive = !['closed', 'resolved', 'complete', 'Closed', 'Resolved'].includes(ticket.status)
  const internalNotes = (threads || []).filter(t => t.action_type === 'internal_note')
  const allThreads    = [...(threads || [])].sort((a, b) =>
    threadOrder === 'asc'
      ? new Date(a.created_at) - new Date(b.created_at)
      : new Date(b.created_at) - new Date(a.created_at)
  )
  const visibleNotes = showAllNotes ? internalNotes : internalNotes.slice(0, 3)
  const visibleAlerts = showAllAlerts ? (alerts || []) : (alerts || []).slice(0, 3)
  const hiddenNotes = internalNotes.length - 3
  const hiddenAlerts = (alerts || []).length - 3
  const slaPct = Math.min(ticket.sla_consumption_pct || 0, 100)

  return (
    <>
    <div className="max-w-screen-xl mx-auto space-y-5 animate-fade-in">

      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/tickets"
          className="flex items-center gap-1.5 text-cortex-muted hover:text-cortex-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Tickets
        </Link>
        <span className="text-cortex-border select-none">/</span>
        <span className="font-mono text-xs text-cortex-text">#{ticketId}</span>
        {ticket.clickup_task_id && (
          <>
            <span className="text-cortex-border select-none">·</span>
            <span className="font-mono text-xs text-cortex-muted">{ticket.clickup_task_id}</span>
          </>
        )}
        {ticket.clickup_url && (
          <a
            href={ticket.clickup_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-cortex-accent hover:underline text-xs ml-0.5"
          >
            Open in ClickUp <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* ── Title + Badges + Quick actions ─────────────────────────── */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-2xl font-display font-bold text-cortex-text leading-tight flex-1">
            {ticket.title}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <button
              onClick={handleAskAI}
              className="flex items-center gap-1.5 text-xs bg-cortex-accent/10 text-cortex-accent hover:bg-cortex-accent/20 px-3 py-1.5 rounded-full transition-colors font-medium"
            >
              <Bot className="w-3.5 h-3.5" /> Ask AI
            </button>
            {isActive && (
              <button
                onClick={() => holdMutation.mutate({ action: isPaused ? 'resume' : 'pause' })}
                disabled={holdMutation.isPending}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors font-medium ${
                  isPaused
                    ? 'bg-cortex-success/10 text-cortex-success hover:bg-cortex-success/20'
                    : 'bg-cortex-warning/10 text-cortex-warning hover:bg-cortex-warning/20'
                }`}
              >
                {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                {isPaused ? 'Resume SLA' : 'Pause SLA'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ticket.channel === 'voice'
            ? <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20">📞 Voice</span>
            : <span className="badge bg-cortex-surface border border-cortex-border text-cortex-muted">✉ Email</span>
          }
          <NewBadge description="Channel tag (new) — Voice or Email source of this ticket. Used for filtering in My Tickets and Call Logs." />
          <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
          {(() => {
            const s = ticket.ai_sentiment; const e = ticket.escalation_level || 0
            const isHigh = s === 'negative' && e >= 2
            const isMed = (s === 'negative' || e >= 2) && !isHigh
            return isHigh
              ? <span className="badge bg-cortex-danger/15 text-cortex-danger">High Risk</span>
              : isMed
              ? <span className="badge bg-cortex-warning/15 text-cortex-warning">Med Risk</span>
              : <span className="badge bg-cortex-success/15 text-cortex-success">Low Risk</span>
          })()}
          <NewBadge description="Risk Badge (new) — AI-powered risk level based on sentiment analysis and escalation level. High Risk = negative sentiment + escalation level 2+." />
          <span className={`badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
          <span className={`badge ${getSLAStatusColor(ticket.sla_status)}`}>
            SLA: {ticket.sla_paused_at ? 'paused' : ticket.sla_status}
          </span>
          {ticket.escalation_level > 0 && (
            <span className={`badge ${getEscalationLevelColor(ticket.escalation_level)}`}>
              L{ticket.escalation_level} Escalation
            </span>
          )}
          {ticket.ai_sentiment && (
            <span className="badge bg-cortex-surface border border-cortex-border text-cortex-muted">
              {getSentimentEmoji(ticket.ai_sentiment)} {ticket.ai_sentiment}
            </span>
          )}
          {ticket.request_type && (
            <span className="badge bg-cortex-surface border border-cortex-border text-cortex-muted">
              {ticket.request_type}
            </span>
          )}
        </div>
      </div>

      {/* ── Admin action toolbar ────────────────────────────────────── */}
      {isAdmin && (
        <div
          className="bg-cortex-surface border border-cortex-border rounded-2xl px-4 py-3 flex items-center gap-2 flex-wrap"
          style={{ boxShadow: '0 1px 3px rgb(0 0 0 / 0.04)' }}
        >
          <span className="text-xs text-cortex-muted font-medium mr-1">Actions</span>

          {/* Status */}
          <div className="relative">
            <button
              onClick={() => { setShowStatusDrop(s => !s); setShowAssignDrop(false); setShowPriorityDrop(false) }}
              disabled={changingStatus}
              className="flex items-center gap-1.5 text-xs bg-cortex-bg border border-cortex-border hover:border-cortex-accent px-3 py-1.5 rounded-lg transition-colors text-cortex-text font-medium"
            >
              {changingStatus ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 text-cortex-muted" />}
              {ticket.status}
              <ChevronDown className="w-3 h-3 text-cortex-muted" />
            </button>
            {showStatusDrop && (
              <div className="absolute top-full left-0 mt-1.5 bg-cortex-surface border border-cortex-border rounded-xl shadow-lg z-30 py-1 min-w-[150px] overflow-hidden animate-slide-in">
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

          {/* Priority */}
          <div className="relative">
            <button
              onClick={() => { setShowPriorityDrop(s => !s); setShowStatusDrop(false); setShowAssignDrop(false) }}
              disabled={changingPriority}
              className="flex items-center gap-1.5 text-xs bg-cortex-bg border border-cortex-border hover:border-cortex-accent px-3 py-1.5 rounded-lg transition-colors text-cortex-text font-medium"
            >
              {changingPriority ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
              {ticket.priority || 'Priority'}
              <ChevronDown className="w-3 h-3 text-cortex-muted" />
            </button>
            {showPriorityDrop && (
              <div className="absolute top-full left-0 mt-1.5 bg-cortex-surface border border-cortex-border rounded-xl shadow-lg z-30 py-1 min-w-[100px] overflow-hidden animate-slide-in">
                {TICKET_PRIORITIES.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-cortex-surface-raised transition-colors ${p === ticket.priority ? 'text-cortex-accent' : 'text-cortex-text'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-cortex-border mx-1" />

          {/* Escalate */}
          <button
            onClick={handleEscalate}
            disabled={escalating}
            className="flex items-center gap-1.5 text-xs bg-cortex-warning/10 text-cortex-warning hover:bg-cortex-warning/20 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <ArrowUpCircle className="w-3 h-3" />
            {escalating ? 'Escalating…' : 'Escalate'}
          </button>
          <NewBadge description="Escalation modal (new) — replaces the old browser popup. Select L1/L2/L3 and enter a required reason. The reason is automatically logged in the Activity Thread." />

          {/* Assign */}
          <div className="relative">
            <button
              onClick={() => { setShowAssignDrop(s => !s); setShowStatusDrop(false); setShowPriorityDrop(false) }}
              disabled={assigning}
              className="flex items-center gap-1.5 text-xs bg-cortex-accent/10 text-cortex-accent hover:bg-cortex-accent/20 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <UserCheck className="w-3 h-3" />
              {ticket.assigned_to_email ? ticket.assigned_to_email.split('@')[0] : 'Assign'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showAssignDrop && (
              <AssignDropdown onAssign={handleAssign} onClose={() => setShowAssignDrop(false)} />
            )}
          </div>

          <div className="w-px h-4 bg-cortex-border mx-1" />

          {/* Flag for QA */}
          {ticket.flag_for_qa ? (
            <button
              onClick={handleUnflag}
              disabled={flagging}
              className="flex items-center gap-1.5 text-xs bg-cortex-danger/10 text-cortex-danger hover:bg-cortex-danger/20 px-3 py-1.5 rounded-lg transition-colors font-medium"
              title={`Flagged: ${ticket.qa_flag_reason || ''}`}
            >
              <Flag className="w-3 h-3 fill-current" />
              {flagging ? 'Removing…' : 'Flagged for QA'}
            </button>
          ) : (
            <button
              onClick={() => { setFlagReason(''); setShowFlagModal(true) }}
              disabled={flagging}
              className="flex items-center gap-1.5 text-xs bg-cortex-bg border border-cortex-border hover:border-cortex-danger/50 hover:text-cortex-danger text-cortex-muted px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <Flag className="w-3 h-3" />
              Flag for QA
            </button>
          )}
        </div>
      )}

      {/* ── 2-column layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* ── LEFT: main content ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Description */}
          {ticket.description && (
            <Section title="Description" icon={AlignLeft} defaultOpen>
              <p className="text-sm text-cortex-muted whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </Section>
          )}

          {/* AI Analysis */}
          {ticket.ai_summary && (
            <Section
              title="AI Analysis"
              icon={Sparkles}
              iconClass="text-cortex-accent"
              className="border-cortex-accent/20 bg-cortex-accent/[0.025]"
              defaultOpen
            >
              <p className="text-sm text-cortex-text leading-relaxed">{ticket.ai_summary}</p>
            </Section>
          )}

          {/* Internal Notes */}
          <Section
            title="Internal Notes"
            icon={StickyNote}
            iconClass="text-amber-500"
            badge={internalNotes.length > 0 ? internalNotes.length : undefined}
            className="border-amber-500/20 bg-amber-500/[0.03]"
            defaultOpen
            headerRight={
              <button
                onClick={() => setShowNoteForm(v => !v)}
                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
              >
                <Plus className="w-3 h-3" /> Add note
              </button>
            }
          >
            {showNoteForm && (
              <div className="mb-4 space-y-2 relative">
                <div className="relative">
                  <textarea
                    ref={noteTextareaRef}
                    value={noteContent}
                    onChange={handleNoteChange}
                    placeholder="Write an internal note… use @ to mention a team member"
                    className="input w-full min-h-[80px] resize-y text-sm pr-8"
                    autoFocus
                  />
                  <AtSign className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-cortex-muted/40 pointer-events-none" />
                  {showMentionDrop && (
                    <div className="absolute left-0 top-full mt-1 bg-cortex-surface border border-cortex-border rounded-xl shadow-lg z-50 py-1 min-w-[180px] max-h-44 overflow-y-auto animate-slide-in">
                      {allUsers
                        .filter(u => u.full_name?.toLowerCase().includes(mentionQuery.toLowerCase()))
                        .slice(0, 8)
                        .map(u => (
                          <button
                            key={u.id}
                            onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                            className="w-full text-left px-3 py-2 hover:bg-cortex-surface-raised transition-colors"
                          >
                            <div className="text-xs font-medium text-cortex-text">{u.full_name}</div>
                            <div className="text-[10px] text-cortex-muted">{u.email}</div>
                          </button>
                        ))}
                      {allUsers.filter(u => u.full_name?.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-xs text-cortex-muted">No match</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote || !noteContent.trim()}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    {addingNote ? 'Saving…' : 'Save Note'}
                  </button>
                  <button onClick={() => { setShowNoteForm(false); setShowMentionDrop(false) }} className="btn-secondary text-xs py-1.5 px-3">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {internalNotes.length === 0 && !showNoteForm ? (
              <p className="text-xs text-cortex-muted text-center py-4">No internal notes yet</p>
            ) : (
              <div className="space-y-3">
                {visibleNotes.map(note => (
                  <div key={note.id} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{note.actor_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-cortex-muted font-mono">{formatDate(note.created_at)}</span>
                        {(note.actor_email === session?.user?.email || isAdmin) && editingNoteId !== note.id && (
                          <>
                            <button
                              onClick={() => { setEditingNoteId(note.id); setEditContent(note.raw_content) }}
                              className="text-cortex-muted hover:text-amber-500 transition-colors"
                              title="Edit note"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-cortex-muted hover:text-cortex-danger transition-colors"
                              title="Delete note"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="space-y-2 mt-1">
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="input w-full min-h-[70px] resize-y text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditNote(note.id)}
                            disabled={savingEdit || !editContent.trim()}
                            className="btn-primary text-xs py-1 px-2.5"
                          >
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingNoteId(null)} className="btn-secondary text-xs py-1 px-2.5">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-cortex-text leading-relaxed whitespace-pre-wrap">{note.raw_content}</p>
                    )}
                  </div>
                ))}
                {hiddenNotes > 0 && (
                  <button
                    onClick={() => setShowAllNotes(v => !v)}
                    className="w-full text-xs text-cortex-muted hover:text-amber-500 border border-dashed border-amber-500/20 rounded-lg py-2 transition-colors"
                  >
                    {showAllNotes ? 'Show fewer' : `Show ${hiddenNotes} more note${hiddenNotes !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* ClickUp Comment */}
          <Section
            title="ClickUp Comment"
            icon={MessageSquare}
            iconClass="text-blue-400"
            className="border-blue-400/20 bg-blue-400/[0.03]"
            defaultOpen={false}
            headerRight={
              <button
                onClick={() => setShowCuCommentForm(v => !v)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                <Plus className="w-3 h-3" /> Add comment
              </button>
            }
          >
              {showCuCommentForm ? (
                <div className="space-y-2">
                  <textarea
                    value={cuComment}
                    onChange={e => setCuComment(e.target.value)}
                    placeholder="Write a comment that will be visible in ClickUp…"
                    className="input w-full min-h-[80px] resize-y text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddClickUpComment}
                      disabled={addingCuComment || !cuComment.trim()}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      {addingCuComment ? 'Posting…' : 'Post to ClickUp'}
                    </button>
                    <button onClick={() => setShowCuCommentForm(false)} className="btn-secondary text-xs py-1.5 px-3">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-cortex-muted text-center py-4">
                  Comments posted here appear in the linked ClickUp task.
                </p>
              )}
            </Section>

          {/* Activity Thread */}
          <Section
            title="Activity Thread"
            icon={MessageSquare}
            badge={allThreads.length > 0 ? allThreads.length : undefined}
            defaultOpen={false}
            headerRight={
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => { setShowLinkModal(true); setLinkSearchQuery(''); setLinkSearchResults([]) }}
                    className="flex items-center gap-1 text-[11px] text-cortex-muted hover:text-cortex-accent transition-colors font-medium"
                    title="Link another ticket as a thread entry on this ticket"
                  >
                    <Link2 className="w-3 h-3" /> Link email
                  </button>
                )}
                {allThreads.length > 0 && (
                  <>
                    <button
                      onClick={() => setThreadOrder(o => o === 'asc' ? 'desc' : 'asc')}
                      className="text-[11px] text-cortex-muted hover:text-cortex-accent transition-colors font-medium font-mono"
                      title="Toggle sort order"
                    >
                      {threadOrder === 'asc' ? '↑ Oldest first' : '↓ Newest first'}
                    </button>
                    <button
                      onClick={() => setThreadExpanded(v => !v)}
                      className="text-[11px] text-cortex-muted hover:text-cortex-accent transition-colors font-medium"
                    >
                      {threadExpanded ? 'Compact' : 'Full view'}
                    </button>
                  </>
                )}
              </div>
            }
          >
            {allThreads.length === 0 ? (
              <p className="text-xs text-cortex-muted text-center py-4">No activity recorded</p>
            ) : threadExpanded ? (
              <div className="space-y-4">
                {allThreads.map(thread => {
                  const isNote = thread.action_type === 'internal_note'
                  return (
                    <div key={thread.id} className={`relative pl-5 pb-5 border-l-2 last:pb-0 ${isNote ? 'border-amber-500/40' : 'border-cortex-border'}`}>
                      <div className={`absolute left-0 top-1 w-2 h-2 -translate-x-[5px] rounded-full ${isNote ? 'bg-amber-500' : 'bg-cortex-accent'}`} />
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold">{thread.actor_name || 'System'}</span>
                        <span className={`badge text-[10px] ${isNote ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-cortex-bg border border-cortex-border text-cortex-muted'}`}>
                          {thread.action_type?.replace(/_/g, ' ')}
                        </span>
                        <ThreadSourceBadge thread={thread} />
                        <span className="text-[11px] text-cortex-muted font-mono ml-auto">{formatRelativeTime(thread.created_at)}</span>
                      </div>
                      {thread.raw_content && (
                        <p className={`text-sm rounded-lg p-3 mt-2 ${isNote ? 'text-cortex-text bg-amber-500/5 border border-amber-500/20' : 'text-cortex-muted bg-cortex-bg'}`}>
                          {thread.raw_content}
                        </p>
                      )}
                      {thread.ai_summary && (
                        <p className="text-sm text-cortex-accent bg-cortex-accent/5 rounded-lg p-3 mt-2">✨ {thread.ai_summary}</p>
                      )}
                      {thread.has_attachments && <p className="text-xs text-cortex-muted mt-1">📎 Has attachments</p>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="divide-y divide-cortex-border/40 -mx-1">
                {allThreads.map(thread => {
                  const isNote = thread.action_type === 'internal_note'
                  return (
                    <div key={thread.id} className="flex items-center gap-3 py-2.5 px-1 text-xs hover:bg-cortex-surface-raised/50 rounded transition-colors">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isNote ? 'bg-amber-500' : 'bg-cortex-accent'}`} />
                      <span className="font-medium text-cortex-text w-28 flex-shrink-0 truncate">
                        {thread.actor_name || 'System'}
                      </span>
                      <span className={`badge text-[10px] flex-shrink-0 ${isNote ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-cortex-bg border border-cortex-border text-cortex-muted'}`}>
                        {thread.action_type?.replace(/_/g, ' ')}
                      </span>
                      <ThreadSourceBadge thread={thread} />
                      {thread.raw_content && (
                        <span className="text-cortex-muted flex-1 truncate hidden sm:block">{thread.raw_content}</span>
                      )}
                      <span className="text-cortex-muted font-mono flex-shrink-0 ml-auto">{formatRelativeTime(thread.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Zoho Email Reply — visible for email channel tickets */}
          {ticket.channel === 'Email' && session?.user?.role === 'admin' && (
            <Section title="Reply via Email" icon={Mail} defaultOpen={false} headerRight={<NewBadge description="New — send an email reply via Zoho Desk. Link a Zoho ticket ID first; replies are logged in the Activity Thread." />}>
              {!ticket.zoho_ticket_id && !zohoIdInput ? (
                <div className="space-y-3">
                  <p className="text-xs text-cortex-muted">Link a Zoho Desk ticket ID to enable email replies.</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Zoho ticket ID (e.g. 1234567)"
                      value={zohoIdInput}
                      onChange={e => setZohoIdInput(e.target.value)}
                      className="input flex-1 text-sm"
                    />
                    <button
                      disabled={savingZohoId || !zohoIdInput.trim()}
                      onClick={async () => {
                        setSavingZohoId(true)
                        try {
                          const res = await fetch(`/api/tickets/${ticketId}/reply`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ zoho_ticket_id: zohoIdInput.trim() }),
                          })
                          if (!res.ok) throw new Error((await res.json()).error)
                          toast.success('Zoho ID saved')
                          qc.invalidateQueries({ queryKey: ['ticket', ticketId] })
                        } catch (e) {
                          toast.error(e.message)
                        } finally {
                          setSavingZohoId(false)
                        }
                      }}
                      className="btn-primary text-sm disabled:opacity-50"
                    >
                      {savingZohoId ? 'Saving…' : 'Link'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-cortex-muted font-mono">
                      Zoho ID: <span className="text-cortex-text font-semibold">{ticket.zoho_ticket_id}</span>
                    </p>
                    <button
                      onClick={async () => {
                        setSavingZohoId(true)
                        try {
                          await fetch(`/api/tickets/${ticketId}/reply`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ zoho_ticket_id: '' }),
                          })
                          qc.invalidateQueries({ queryKey: ['ticket', ticketId] })
                        } catch {}
                        setSavingZohoId(false)
                      }}
                      className="text-[10px] text-cortex-muted hover:text-cortex-danger transition-colors"
                    >
                      Unlink
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Type your reply…"
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    className="input w-full text-sm resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={sendingReply || !replyContent.trim()}
                      onClick={async () => {
                        setSendingReply(true)
                        try {
                          const res = await fetch(`/api/tickets/${ticketId}/reply`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: replyContent }),
                          })
                          if (!res.ok) throw new Error((await res.json()).error)
                          toast.success('Reply sent via Zoho Desk')
                          setReplyContent('')
                          qc.invalidateQueries({ queryKey: ['ticket', ticketId] })
                        } catch (e) {
                          toast.error(e.message)
                        } finally {
                          setSendingReply(false)
                        }
                      }}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendingReply ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Similar Tickets */}
          {similarTickets.length > 0 && (
            <Section title="Similar Resolved Tickets" icon={History} badge={similarTickets.length} defaultOpen={false}>
              <div className="space-y-2">
                {similarTickets.map(t => (
                  <Link
                    key={t.id}
                    href={`/tickets/${t.id}`}
                    className="flex items-center justify-between p-3 bg-cortex-bg rounded-xl hover:bg-cortex-surface-raised transition-colors border border-cortex-border group"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-medium text-cortex-text truncate group-hover:text-cortex-accent transition-colors">{t.title}</p>
                      <p className="text-xs text-cortex-muted mt-0.5">{t.module} · {t.request_type}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`badge text-[10px] ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                      <span className="text-[10px] text-cortex-muted font-mono">
                        {t.resolved_at ? formatRelativeTime(t.resolved_at) : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ── RIGHT: sidebar ── */}
        <div className="space-y-4">

          {/* SLA Status */}
          <Section title="SLA Status" icon={Clock} iconClass="text-cortex-warning" defaultOpen>
            <div className="space-y-3">
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
                    {!isPaused && isActive && <SLACountdown dueDate={ticket.sla_resolution_due} label="" />}
                    {!isPaused && !isActive && <span className="text-xs font-mono text-cortex-success">Completed</span>}
                  </div>
                </div>
              )}
              {ticket.sla_response_due && !isPaused && isActive && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-cortex-muted">Response due</span>
                  <SLACountdown dueDate={ticket.sla_response_due} label="" />
                </div>
              )}
              {isPaused && (
                <p className="text-xs text-blue-500">Paused since {formatDate(ticket.sla_paused_at)}</p>
              )}
            </div>
          </Section>

          {/* Reporter */}
          <Section title="Reporter" icon={User} defaultOpen>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-cortex-text flex items-center gap-1.5">
                {ticket.poc_name || ticket.created_by_name || 'Unknown'}
                {ticket.poc_is_vip && <span title="VIP customer">⭐</span>}
              </p>
              <p className="text-xs text-cortex-muted">{ticket.poc_email || ticket.created_by_email || '—'}</p>
              {ticket.poc_phone && <p className="text-xs text-cortex-muted font-mono mt-1">{ticket.poc_phone}</p>}
              {ticket.poc_id && (
                <div className="mt-2">
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                    ticket.poc_open_ticket_count > 0
                      ? 'bg-cortex-warning/15 text-cortex-warning'
                      : 'bg-cortex-success/15 text-cortex-success'
                  }`}>
                    {ticket.poc_open_ticket_count > 0
                      ? `${ticket.poc_open_ticket_count} other open ticket${ticket.poc_open_ticket_count !== 1 ? 's' : ''}`
                      : 'No other open tickets'}
                  </span>
                </div>
              )}
              {ticket.poc_recent_threads?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-cortex-border/40">
                  <p className="text-[10px] text-cortex-muted uppercase tracking-wider mb-2">Last Interactions</p>
                  <div className="space-y-2">
                    {ticket.poc_recent_threads.map((th, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cortex-muted mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-cortex-muted capitalize">
                            {th.action_type?.replace(/_/g, ' ') || 'Note'} · {formatDate(th.created_at)}
                          </p>
                          <p className="text-xs text-cortex-text line-clamp-1">
                            {(th.raw_content || th.new_value || '').substring(0, 80) || '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {ticket.assigned_to_email && (
                <div className="mt-3 pt-3 border-t border-cortex-border/40">
                  <p className="text-[10px] text-cortex-muted uppercase tracking-wider mb-1">Assigned to</p>
                  <p className="text-sm font-medium text-cortex-text">{ticket.assigned_to_email.split('@')[0]}</p>
                  <p className="text-xs text-cortex-muted">{ticket.assigned_to_email}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Activity timestamps */}
          <Section title="Activity" icon={BarChart2} defaultOpen>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-cortex-muted">Created</span>
                <span className="text-xs font-mono">{formatRelativeTime(ticket.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-cortex-muted">Updated</span>
                <span className="text-xs font-mono">{formatRelativeTime(ticket.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-cortex-muted">Thread entries</span>
                <span className="text-xs font-mono font-bold">{allThreads.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-cortex-muted">Internal notes</span>
                <span className="text-xs font-mono font-bold">{internalNotes.length}</span>
              </div>
            </div>
          </Section>

          {/* Additional Details */}
          {(ticket.module || ticket.operating_system || ticket.mobile_or_national_id || ticket.case_type) && (
            <Section title="Details" icon={Tag} defaultOpen>
              <div className="space-y-2.5">
                {ticket.module && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-cortex-muted flex-shrink-0">Module</span>
                    <span className="text-xs font-medium text-cortex-text text-right">{ticket.module}</span>
                  </div>
                )}
                {ticket.case_type && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-cortex-muted flex-shrink-0">Case type</span>
                    <span className="text-xs font-medium text-cortex-text text-right">{ticket.case_type}</span>
                  </div>
                )}
                {ticket.operating_system && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-cortex-muted flex-shrink-0">OS</span>
                    <span className="text-xs font-medium text-cortex-text text-right">{ticket.operating_system}</span>
                  </div>
                )}
                {ticket.mobile_or_national_id && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-cortex-muted flex-shrink-0">Patient ID</span>
                    <span className="text-xs font-mono text-cortex-text">{ticket.mobile_or_national_id}</span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Escalation Alerts */}
          {alerts && alerts.length > 0 && (
            <Section
              title="Escalation Alerts"
              icon={AlertTriangle}
              iconClass="text-cortex-danger"
              badge={alerts.length}
              className="border-cortex-danger/20 bg-cortex-danger/[0.025]"
              defaultOpen
            >
              <div className="space-y-2.5">
                {visibleAlerts.map(alert => (
                  <div key={alert.id} className="p-3 bg-cortex-bg rounded-xl border border-cortex-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`badge text-[10px] ${getEscalationLevelColor(alert.alert_level)}`}>
                        Level {alert.alert_level}
                      </span>
                      <span className="text-[10px] text-cortex-muted font-mono">{formatRelativeTime(alert.created_at)}</span>
                    </div>
                    <p className="text-xs text-cortex-muted">Consumption: {alert.consumption_pct}%</p>
                    {alert.notified_emails?.length > 0 && (
                      <p className="text-[10px] text-cortex-muted mt-1 truncate">
                        Notified: {alert.notified_emails.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
                {hiddenAlerts > 0 && (
                  <button
                    onClick={() => setShowAllAlerts(v => !v)}
                    className="w-full text-xs text-cortex-muted hover:text-cortex-danger border border-dashed border-cortex-danger/20 rounded-lg py-2 transition-colors"
                  >
                    {showAllAlerts ? 'Show fewer' : `+${hiddenAlerts} more`}
                  </button>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>

    {/* ── Flag for QA modal ── */}
    {showFlagModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-md animate-slide-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
            <h2 className="font-display font-bold text-cortex-text flex items-center gap-2">
              <Flag className="w-4 h-4 text-cortex-danger" /> Flag for QA Review
            </h2>
            <button onClick={() => setShowFlagModal(false)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted hover:text-cortex-text transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-2">Reason *</label>
              <textarea
                value={flagReason}
                onChange={e => setFlagReason(e.target.value)}
                placeholder="Why should this ticket be reviewed by QA?…"
                className="input min-h-[90px] resize-y text-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleFlagSubmit}
                disabled={!flagReason.trim() || flagging}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {flagging ? 'Flagging…' : 'Flag for QA'}
              </button>
              <button onClick={() => setShowFlagModal(false)} className="btn-secondary px-5">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Link email as thread modal ── */}
    {showLinkModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-lg animate-slide-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
            <h2 className="font-display font-bold text-cortex-text flex items-center gap-2">
              <Link2 className="w-4 h-4 text-cortex-accent" /> Link Email as Thread
            </h2>
            <button onClick={() => setShowLinkModal(false)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted hover:text-cortex-text transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-xs text-cortex-muted">Search for a ticket whose content you want to link as a thread entry on this ticket. The source ticket will not be deleted.</p>
            <input
              type="text"
              placeholder="Search by ticket title or ID…"
              value={linkSearchQuery}
              onChange={e => { setLinkSearchQuery(e.target.value); handleLinkSearch(e.target.value) }}
              className="input text-sm"
              autoFocus
            />
            {linkSearching && <p className="text-xs text-cortex-muted text-center py-2">Searching…</p>}
            {!linkSearching && linkSearchResults.length > 0 && (
              <div className="border border-cortex-border rounded-xl overflow-hidden divide-y divide-cortex-border/40 max-h-56 overflow-y-auto">
                {linkSearchResults.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleLinkAsThread(t.id)}
                    disabled={linkingTicket}
                    className="w-full text-left px-4 py-3 hover:bg-cortex-surface-raised transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-cortex-text truncate">#{t.id} — {t.title}</p>
                        <p className="text-[10px] text-cortex-muted mt-0.5">{t.channel} · {t.status} · {formatRelativeTime(t.created_at)}</p>
                      </div>
                      <span className={`badge text-[10px] flex-shrink-0 ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!linkSearching && linkSearchQuery.trim() && linkSearchResults.length === 0 && (
              <p className="text-xs text-cortex-muted text-center py-2">No tickets found</p>
            )}
            <div className="flex justify-end pt-1">
              <button onClick={() => setShowLinkModal(false)} className="btn-secondary px-5">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Escalation modal ── */}
    {showEscalateModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-md animate-slide-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
            <h2 className="font-display font-bold text-cortex-text flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-cortex-warning" /> Escalate Ticket
            </h2>
            <button onClick={() => setShowEscalateModal(false)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted hover:text-cortex-text transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-2">Escalation Level</label>
              <div className="flex gap-2">
                {['1', '2', '3'].map(l => (
                  <button
                    key={l}
                    onClick={() => setEscalateLevel(l)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                      escalateLevel === l
                        ? 'bg-cortex-warning/15 text-cortex-warning border-cortex-warning/40'
                        : 'bg-cortex-bg border-cortex-border text-cortex-muted hover:border-cortex-muted hover:text-cortex-text'
                    }`}
                  >
                    Level {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-2">Reason *</label>
              <textarea
                value={escalateReason}
                onChange={e => setEscalateReason(e.target.value)}
                placeholder="Explain why this ticket needs escalation…"
                className="input min-h-[90px] resize-y text-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={submitEscalation}
                disabled={!escalateReason.trim() || escalating}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {escalating ? 'Escalating…' : `Escalate to Level ${escalateLevel}`}
              </button>
              <button onClick={() => setShowEscalateModal(false)} className="btn-secondary px-5">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

/* ── Assign dropdown ────────────────────────────────────────────────── */
function AssignDropdown({ onAssign, onClose }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['clickup-members'],
    queryFn: () => fetch('/api/clickup/users').then(r => r.json()),
    staleTime: 300000,
  })

  return (
    <div className="absolute top-full left-0 mt-1.5 bg-cortex-surface border border-cortex-border rounded-xl shadow-lg z-50 py-1 min-w-[200px] max-h-56 overflow-y-auto animate-slide-in">
      {isLoading ? (
        <p className="px-4 py-3 text-xs text-cortex-muted">Loading members…</p>
      ) : members.length === 0 ? (
        <p className="px-4 py-3 text-xs text-cortex-muted">No members found</p>
      ) : (
        <>
          <button
            onClick={() => { onAssign(null, null); onClose() }}
            className="w-full text-left px-4 py-2 text-xs text-cortex-muted hover:bg-cortex-surface-raised transition-colors"
          >
            Unassign
          </button>
          <div className="border-t border-cortex-border/40 my-1" />
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => { onAssign(null, m.email); onClose() }}
              className="w-full text-left px-4 py-2 hover:bg-cortex-surface-raised transition-colors"
            >
              <div className="text-xs font-medium text-cortex-text">{m.username}</div>
              <div className="text-[10px] text-cortex-muted">{m.email}</div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
