'use client'

import { useState, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Ticket,
  Clock,
  AlertTriangle,
  Search,
  Building2,
  X,
  ArrowUpDown,
  Plus,
  LayoutGrid,
  List,
  CheckSquare,
  ExternalLink,
  RefreshCw,
  Key,
  Trash2,
  AlertCircle,
  ListTodo,
} from 'lucide-react'
import { getSLAStatusColor, getPriorityColor, formatRelativeTime, cn } from '@/lib/utils'
import { createTicket } from '@/lib/api'
import TicketThread from '@/components/tickets/TicketThread'
import TicketSidebar from '@/components/tickets/TicketSidebar'
import toast from 'react-hot-toast'

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'all',         label: 'All',         statusFilter: null },
  { key: 'open',        label: 'Open',        statusFilter: 'Open' },
  { key: 'in_progress', label: 'In Progress', statusFilter: 'In Progress' },
  { key: 'waiting',     label: 'Waiting',     statusFilter: 'Waiting' },
  { key: 'resolved',    label: 'Resolved',    statusFilter: 'Resolved' },
]

const CHANNEL_FILTERS = [
  { key: 'all',     label: 'All Channels' },
  { key: 'call',    label: '📞 Call' },
  { key: 'apex',    label: '🖥 Dashboard' },
  { key: 'email',   label: '✉ Email' },
  { key: 'clickup', label: '📋 ClickUp' },
]

const PRIORITY_OPTIONS = ['All', 'P1', 'P2', 'P3', 'P4']
const SLA_STATUS_OPTIONS = [
  { key: '', label: 'All SLA' },
  { key: 'critical', label: '🔴 Critical' },
  { key: 'at_risk',  label: '🟠 At Risk' },
  { key: 'warning',  label: '🟡 Warning' },
  { key: 'healthy',  label: '🟢 Healthy' },
]

const TASK_PRIORITY_COLORS = {
  urgent: 'bg-red-500/15 text-red-400',
  high:   'bg-cortex-warning/15 text-cortex-warning',
  normal: 'bg-cortex-accent/15 text-cortex-accent',
  low:    'bg-cortex-muted/15 text-cortex-muted',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fetchMyTickets(params = {}) {
  const qs = new URLSearchParams({ limit: '200', ...params }).toString()
  return fetch(`/api/tickets?${qs}`).then(r => r.ok ? r.json() : { tickets: [], total: 0 })
}

function getSLABarColor(slaStatus) {
  const map = {
    healthy:  'bg-cortex-success',
    warning:  'bg-cortex-warning',
    at_risk:  'bg-orange-500',
    critical: 'bg-cortex-danger',
    breached: 'bg-cortex-critical',
  }
  return map[slaStatus] || 'bg-cortex-muted'
}

function getSLABorderColor(slaStatus) {
  const map = {
    healthy:  'border-l-cortex-success',
    warning:  'border-l-cortex-warning',
    at_risk:  'border-l-orange-500',
    critical: 'border-l-cortex-danger',
    breached: 'border-l-red-600',
  }
  return map[slaStatus] || 'border-l-cortex-border'
}

function normStatus(s) { return (s || '').toLowerCase().replace(/[\s_]/g, '') }

function getTaskPriorityColor(p) {
  return TASK_PRIORITY_COLORS[p?.toLowerCase()] || 'bg-cortex-muted/15 text-cortex-muted'
}

// ─── ClickUp Tasks Tab ───────────────────────────────────────────────────────

async function fetchTasks() {
  const res = await fetch('/api/tasks')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (data.error === 'no_token') return { noToken: true }
    if (data.error === 'invalid_token') return { invalidToken: true }
    throw new Error(data.error || 'Failed to fetch tasks')
  }
  return res.json()
}

async function saveToken(token) {
  const res = await fetch('/api/users/me/clickup-token', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to save token')
  return data
}

async function removeToken() {
  const res = await fetch('/api/users/me/clickup-token', { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove token')
}

async function markComplete(taskId) {
  const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to mark complete')
  }
}

function MyTasksTab() {
  const queryClient = useQueryClient()
  const [tokenInput, setTokenInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: fetchTasks,
    refetchInterval: 60000,
    retry: false,
  })

  const handleSaveToken = async (e) => {
    e.preventDefault()
    if (!tokenInput.trim()) return
    setSaving(true)
    try {
      const result = await saveToken(tokenInput.trim())
      toast.success(`Connected as ${result.clickup_username || result.clickup_email}`)
      setTokenInput('')
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveToken = async () => {
    try {
      await removeToken()
      toast.success('ClickUp token removed')
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleMarkComplete = async (taskId) => {
    setCompleting(taskId)
    try {
      await markComplete(taskId)
      toast.success('Task marked complete')
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCompleting(null)
    }
  }

  const showTokenSetup = data?.noToken || data?.invalidToken

  return (
    <div className="space-y-5">
      {/* Actions bar */}
      {!showTokenSetup && !isLoading && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-cortex-muted">
            Tasks assigned to you in ClickUp — synced every 60 seconds.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={handleRemoveToken}
              className="flex items-center gap-1.5 text-xs text-cortex-muted hover:text-cortex-danger transition-colors"
              title="Disconnect ClickUp"
            >
              <Trash2 className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Token setup */}
      {showTokenSetup && (
        <div className="card max-w-lg">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cortex-accent/10 flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5 text-cortex-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-cortex-text mb-1">Connect your ClickUp account</h2>
              {data?.invalidToken ? (
                <p className="text-sm text-cortex-danger">Your saved token is no longer valid. Please enter a new one.</p>
              ) : (
                <p className="text-sm text-cortex-muted">
                  Paste your ClickUp personal API token to see tasks assigned to you.
                  Get it from <span className="text-cortex-accent font-medium">ClickUp → Settings → Apps → API Token</span>.
                </p>
              )}
            </div>
          </div>
          <form onSubmit={handleSaveToken} className="space-y-3">
            <input
              type="password"
              placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              className="input w-full font-mono text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={saving || !tokenInput.trim()}
              className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying…</> : 'Connect ClickUp'}
            </button>
          </form>
        </div>
      )}

      {/* Loading */}
      {isLoading && !showTokenSetup && (
        <div className="card space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-cortex-bg animate-pulse rounded-xl" />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card flex items-center gap-3 text-cortex-danger bg-cortex-danger/5 border-cortex-danger/20">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      {/* Task list */}
      {data?.tasks && (
        data.tasks.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 text-cortex-muted">
            <div className="w-14 h-14 rounded-2xl bg-cortex-surface-raised flex items-center justify-center mb-4">
              <ListTodo className="w-7 h-7 opacity-40" />
            </div>
            <p className="font-medium text-cortex-text mb-1">No open tasks</p>
            <p className="text-sm">Tasks assigned to you in ClickUp will appear here</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-cortex-border bg-cortex-bg flex items-center justify-between">
              <span className="text-sm font-semibold text-cortex-text">
                {data.tasks.length} open task{data.tasks.length !== 1 ? 's' : ''}
              </span>
              {data.clickup_user && (
                <span className="text-xs text-cortex-muted font-mono">
                  {data.clickup_user.username || data.clickup_user.email}
                </span>
              )}
            </div>
            <div className="divide-y divide-cortex-border">
              {data.tasks.map(task => (
                <div key={task.id} className="px-5 py-4 flex items-start gap-4 hover:bg-cortex-surface-raised transition-colors group">
                  <button
                    onClick={() => handleMarkComplete(task.id)}
                    disabled={completing === task.id}
                    title="Mark complete"
                    className="mt-0.5 flex-shrink-0 text-cortex-muted hover:text-cortex-success transition-colors disabled:opacity-40"
                  >
                    {completing === task.id
                      ? <RefreshCw className="w-5 h-5 animate-spin" />
                      : <CheckSquare className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {task.priority && (
                        <span className={`badge text-[10px] ${getTaskPriorityColor(task.priority)}`}>{task.priority}</span>
                      )}
                      <span className="badge bg-cortex-surface-raised text-cortex-muted text-[10px] capitalize">{task.status}</span>
                      {task.due_date && (
                        <span className={`text-[10px] font-mono ${new Date(task.due_date) < new Date() ? 'text-cortex-danger' : 'text-cortex-muted'}`}>
                          Due {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-cortex-text">{task.name}</p>
                    {task.description && (
                      <p className="text-xs text-cortex-muted mt-1 line-clamp-2">{task.description}</p>
                    )}
                  </div>
                  {task.url && (
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-cortex-muted hover:text-cortex-accent transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
                      title="Open in ClickUp"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

function MyTicketsInner() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('selected') ? Number(searchParams.get('selected')) : null

  // Top-level tab: tickets | tasks
  const [mainTab, setMainTab] = useState('tickets')

  // Tickets-specific state
  const [activeStatus, setActiveStatus] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [slaFilter, setSlaFilter] = useState('')
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [slaAsc, setSlaAsc] = useState(false)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'

  // New ticket modal state
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState('P3')
  const [newChannel, setNewChannel] = useState('apex')

  const currentStatusTab = STATUS_TABS.find(t => t.key === activeStatus)
  const agentEmail = session?.user?.email

  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['my-tickets', agentEmail],
    queryFn: () => fetchMyTickets({ ...(agentEmail ? { assigned_to: agentEmail } : {}) }),
    refetchInterval: 30000,
    enabled: !!agentEmail,
  })

  const allTickets = ticketData?.tickets ?? (Array.isArray(ticketData) ? ticketData : [])
  const orgOptions = [...new Set(allTickets.map(t => t.company_name || t.company_code).filter(Boolean))].sort()

  // Status counts for banner
  const statusCounts = {
    open:        allTickets.filter(t => normStatus(t.status) === 'open').length,
    in_progress: allTickets.filter(t => normStatus(t.status) === 'inprogress').length,
    waiting:     allTickets.filter(t => normStatus(t.status) === 'waiting').length,
    resolved:    allTickets.filter(t => ['resolved', 'complete', 'completed', 'closed'].includes(normStatus(t.status))).length,
    all:         allTickets.length,
  }

  const filtered = allTickets.filter(t => {
    const matchSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.id?.toString().includes(search)
    const matchOrg = !orgFilter || t.company_name === orgFilter || t.company_code === orgFilter
    const matchChannel = channelFilter === 'all' || t.channel === channelFilter
    const matchPriority = priorityFilter === 'All' || t.priority === priorityFilter
    const matchSla = !slaFilter || t.sla_status === slaFilter
    const matchStatus = !currentStatusTab.statusFilter ||
      normStatus(t.status) === normStatus(currentStatusTab.statusFilter) ||
      (currentStatusTab.key === 'resolved' && ['resolved', 'complete', 'completed', 'closed'].includes(normStatus(t.status)))
    return matchSearch && matchOrg && matchChannel && matchPriority && matchSla && matchStatus
  })

  const sorted = [...filtered].sort((a, b) => {
    const slaOrder = { critical: 0, at_risk: 1, warning: 2, healthy: 3 }
    const slaA = slaOrder[a.sla_status] ?? 4
    const slaB = slaOrder[b.sla_status] ?? 4
    if (slaA !== slaB) return slaAsc ? slaB - slaA : slaA - slaB
    return slaAsc
      ? (a.sla_consumption_pct || 0) - (b.sla_consumption_pct || 0)
      : (b.sla_consumption_pct || 0) - (a.sla_consumption_pct || 0)
  })

  const selectTicket = (id) => router.replace(`/my-tickets?selected=${id}`, { scroll: false })
  const clearSelection = () => router.replace('/my-tickets', { scroll: false })

  // ── 3-panel layout when a ticket is selected ─────────────────────────────
  if (selectedId) {
    return (
      <div className="flex gap-0 h-[calc(100vh-48px)] -m-6 overflow-hidden">
        {/* Left: compact ticket list */}
        <div className="w-72 flex-shrink-0 border-r border-cortex-border bg-cortex-surface flex flex-col">
          <div className="px-3 py-3 border-b border-cortex-border flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cortex-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="input pl-8 text-xs py-1.5 h-7 w-full"
              />
            </div>
            <button
              onClick={clearSelection}
              className="p-1.5 text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised rounded-lg transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-2 py-2 border-b border-cortex-border flex gap-1 flex-wrap">
            {STATUS_TABS.slice(0, 5).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveStatus(tab.key)}
                className={cn(
                  'px-2 py-1 text-[10px] font-semibold rounded transition-colors',
                  activeStatus === tab.key
                    ? 'bg-cortex-accent/15 text-cortex-accent'
                    : 'text-cortex-muted hover:bg-cortex-surface-raised hover:text-cortex-text'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-cortex-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-3 animate-pulse">
                  <div className="h-3 bg-cortex-bg rounded mb-2 w-3/4" />
                  <div className="h-3 bg-cortex-bg rounded w-1/2" />
                </div>
              ))
            ) : sorted.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-cortex-muted">No tickets</div>
            ) : sorted.map(ticket => {
              const isSelected = ticket.id === selectedId
              return (
                <button
                  key={ticket.id}
                  onClick={() => selectTicket(ticket.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 hover:bg-cortex-surface-raised transition-colors flex items-start gap-2.5 group border-l-2',
                    isSelected ? 'bg-cortex-accent/8 border-l-cortex-accent' : 'border-l-transparent'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`badge text-[9px] py-0 ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                      {ticket.escalation_level > 0 && <AlertTriangle className="w-3 h-3 text-cortex-warning" />}
                    </div>
                    <p className={cn('text-xs font-medium line-clamp-2 leading-snug', isSelected ? 'text-cortex-accent' : 'text-cortex-text')}>
                      {ticket.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-mono ${getSLAStatusColor(ticket.sla_status)}`}>
                        {ticket.sla_consumption_pct != null ? `${Math.round(ticket.sla_consumption_pct)}%` : '—'}
                      </span>
                      <span className="text-[10px] text-cortex-muted">·</span>
                      <span className="text-[10px] text-cortex-muted">{formatRelativeTime(ticket.created_at)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        {/* Center: thread */}
        <div className="flex-1 overflow-y-auto p-5 bg-cortex-bg">
          <TicketThread ticketId={selectedId} />
        </div>
        {/* Right: sidebar */}
        <div className="w-72 flex-shrink-0 border-l border-cortex-border bg-cortex-surface overflow-y-auto p-3">
          <TicketSidebar ticketId={selectedId} onTicketUpdated={() => {}} />
        </div>
      </div>
    )
  }

  // ── Full-width view ───────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">My Queue</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">My Tickets</h1>
        </div>
        {mainTab === 'tickets' && (
          <button
            onClick={() => { setShowCreate(true); setNewTitle(''); setNewDesc(''); setNewPriority('P3'); setNewChannel('apex') }}
            className="flex items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        )}
      </div>

      {/* Main tab switcher */}
      <div className="flex items-center gap-1 border-b border-cortex-border">
        {[
          { key: 'tickets', label: 'My Tickets', icon: Ticket },
          { key: 'tasks',   label: 'My Tasks',   icon: ListTodo },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
              mainTab === key
                ? 'border-cortex-accent text-cortex-accent'
                : 'border-transparent text-cortex-muted hover:text-cortex-text'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === 'tickets' && !isLoading && (
              <span className="ml-1 text-[10px] opacity-70">{allTickets.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TICKETS TAB ─────────────────────────────────────────────────── */}
      {mainTab === 'tickets' && (
        <>
          {/* Status banner chips */}
          {!isLoading && allTickets.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {STATUS_TABS.map(tab => {
                const count = tab.key === 'all' ? statusCounts.all : statusCounts[tab.key] ?? 0
                const isActive = activeStatus === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveStatus(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                      isActive
                        ? 'bg-cortex-accent/15 text-cortex-accent border-cortex-accent/30'
                        : 'bg-cortex-surface text-cortex-muted border-cortex-border hover:text-cortex-text hover:bg-cortex-surface-raised'
                    )}
                  >
                    {tab.label}
                    <span className={cn('font-bold', isActive ? 'text-cortex-accent' : 'text-cortex-text')}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Filter bar */}
          <div className="flex gap-3 flex-wrap items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or #ID…"
                className="input pl-9 w-56"
              />
            </div>
            {/* Priority */}
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="input w-32">
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p === 'All' ? 'All Priority' : p}</option>)}
            </select>
            {/* SLA Status */}
            <select value={slaFilter} onChange={e => setSlaFilter(e.target.value)} className="input w-36">
              {SLA_STATUS_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
            </select>
            {/* Channel */}
            <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="input w-36">
              {CHANNEL_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            {/* Org filter */}
            {orgOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cortex-muted" />
                <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className="input w-36">
                  <option value="">All Orgs</option>
                  {orgOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            {/* SLA sort */}
            <button
              onClick={() => setSlaAsc(a => !a)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                slaAsc
                  ? 'bg-cortex-accent/15 text-cortex-accent border-cortex-accent/30'
                  : 'text-cortex-muted border-cortex-border hover:text-cortex-text'
              )}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              SLA {slaAsc ? '↑' : '↓'}
            </button>
            {/* View toggle */}
            <div className="flex items-center gap-1 ml-auto border border-cortex-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn('p-2 transition-colors', viewMode === 'list' ? 'bg-cortex-accent/15 text-cortex-accent' : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised')}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-cortex-accent/15 text-cortex-accent' : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised')}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Result count */}
          {!isLoading && (
            <p className="text-xs text-cortex-muted font-mono">
              {sorted.length} ticket{sorted.length !== 1 ? 's' : ''}
              {(priorityFilter !== 'All' || slaFilter || channelFilter !== 'all' || search) && ' (filtered)'}
            </p>
          )}

          {/* Ticket list */}
          {isLoading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-3'}>
              {[1, 2, 3].map(i => <div key={i} className="card animate-pulse h-20" />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="card text-center py-12">
              <Ticket className="w-8 h-8 text-cortex-muted mx-auto mb-2" />
              <p className="text-cortex-muted text-sm">No tickets found.</p>
            </div>
          ) : viewMode === 'list' ? (
            /* ── List View ── */
            <div className="space-y-2">
              {sorted.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => selectTicket(ticket.id)}
                  className={cn(
                    'card w-full text-left flex items-center gap-4 hover:border-cortex-accent/40 transition-colors group border-l-4',
                    getSLABorderColor(ticket.sla_status)
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-cortex-muted">#{ticket.id}</span>
                      <span className={`badge ${getPriorityColor(ticket.priority)} text-xs`}>{ticket.priority}</span>
                      {ticket.escalation_level > 0 && <AlertTriangle className="w-3.5 h-3.5 text-cortex-warning" />}
                    </div>
                    <p className="text-sm font-medium text-cortex-text truncate group-hover:text-cortex-accent transition-colors">
                      {ticket.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-cortex-muted">
                      <span>{ticket.status}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(ticket.created_at)}
                      </span>
                      {ticket.sla_consumption_pct != null && (
                        <>
                          <span>·</span>
                          <span className={`font-mono ${getSLAStatusColor(ticket.sla_status)}`}>
                            SLA {Math.round(ticket.sla_consumption_pct)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-cortex-muted group-hover:text-cortex-accent transition-colors shrink-0 text-xs">Open →</div>
                </button>
              ))}
            </div>
          ) : (
            /* ── Grid / Card View ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sorted.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => selectTicket(ticket.id)}
                  className={cn(
                    'card text-left flex flex-col gap-3 hover:border-cortex-accent/40 transition-colors group border-l-4 p-4',
                    getSLABorderColor(ticket.sla_status)
                  )}
                >
                  {/* Top row: priority + id */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getPriorityColor(ticket.priority)} text-xs`}>{ticket.priority}</span>
                      {ticket.escalation_level > 0 && <AlertTriangle className="w-3.5 h-3.5 text-cortex-warning" />}
                    </div>
                    <span className="text-[10px] font-mono text-cortex-muted">#{ticket.id}</span>
                  </div>
                  {/* Title */}
                  <p className="text-sm font-medium text-cortex-text line-clamp-2 group-hover:text-cortex-accent transition-colors leading-snug flex-1">
                    {ticket.title}
                  </p>
                  {/* SLA bar */}
                  {ticket.sla_consumption_pct != null && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-cortex-muted">SLA</span>
                        <span className={`font-mono ${getSLAStatusColor(ticket.sla_status)}`}>
                          {Math.round(ticket.sla_consumption_pct)}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-cortex-border overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getSLABarColor(ticket.sla_status)}`}
                          style={{ width: `${Math.min(ticket.sla_consumption_pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 text-[10px] text-cortex-muted">
                    <span className="badge text-[9px] py-0 px-1.5 bg-cortex-surface-raised text-cortex-muted capitalize">
                      {ticket.status}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(ticket.created_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TASKS TAB ───────────────────────────────────────────────────── */}
      {mainTab === 'tasks' && <MyTasksTab />}

      {/* ── New Ticket Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-cortex-surface border border-cortex-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-cortex-text">New Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="text-cortex-muted hover:text-cortex-text">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title *"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="input w-full"
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="input w-full resize-none h-20"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-cortex-muted mb-1 block">Priority</label>
                  <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="input w-full">
                    <option value="P1">P1 — Critical</option>
                    <option value="P2">P2 — High</option>
                    <option value="P3">P3 — Medium</option>
                    <option value="P4">P4 — Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-cortex-muted mb-1 block">Channel</label>
                  <select value={newChannel} onChange={e => setNewChannel(e.target.value)} className="input w-full">
                    <option value="apex">🖥 Dashboard</option>
                    <option value="call">📞 Call</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={async () => {
                  if (!newTitle.trim()) return
                  setCreating(true)
                  try {
                    await createTicket({ title: newTitle.trim(), description: newDesc.trim() || undefined, priority: newPriority, channel: newChannel })
                    setShowCreate(false)
                  } catch (e) {
                    alert(e.message || 'Failed to create ticket')
                  } finally {
                    setCreating(false)
                  }
                }}
                disabled={!newTitle.trim() || creating}
                className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating…' : 'Create Ticket'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyTicketsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-cortex-muted text-sm">Loading…</div>}>
      <MyTicketsInner />
    </Suspense>
  )
}
