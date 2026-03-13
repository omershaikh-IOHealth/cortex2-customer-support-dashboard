'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTickets, holdTicket, getAdminCompanies, getPOCs, getModules, getRequestTypes, getCaseTypes, createTicket, addTicketNote, getUsers, getTicketTags, addTagToTicket, updateTicket, getSolutions } from '@/lib/api'
import { useCompany } from '@/context/CompanyContext'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { getSLAStatusColor, getPriorityColor, getStatusColor, formatRelativeTime, truncate, getSentimentEmoji } from '@/lib/utils'
import { Search, ExternalLink, Bookmark, Trash2, PauseCircle, PlayCircle, Plus, X, Loader2, ChevronLeft, ChevronRight, ArrowUpCircle, CheckSquare, Square, Tag, UserCheck, RefreshCw } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'

const PRESETS_KEY     = 'cortex_filter_presets'
const LAST_PRESET_KEY = 'cortex_last_preset'

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]') } catch { return [] }
}
function savePresets(p) { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)) }

const BLANK_TICKET = { title: '', description: '', priority: 'P3', status: 'Open', module: '', request_type: '', case_type: '', poc_id: '', company_id: '', solution_id: '' }

export default function TicketsPage() {
  const queryClient = useQueryClient()
  const { company } = useCompany()
  const [filters, setFilters]         = useState({ status: '', priority: '', sla_status: '' })
  const [searchTerm, setSearchTerm]   = useState('')
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(25)
  const [presets, setPresets]         = useState([])
  const [presetName, setPresetName]   = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [showCreate, setShowCreate]   = useState(false)
  const [createForm, setCreateForm]   = useState(BLANK_TICKET)
  const [createError, setCreateError] = useState('')
  const [escalateTarget, setEscalateTarget] = useState(null) // ticketId | null
  const [escalateLevel, setEscalateLevel]   = useState('1')
  const [escalateReason, setEscalateReason] = useState('')
  const [escalating, setEscalating]         = useState(false)

  // ── Bulk actions ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]       = useState(new Set())
  const [bulkAction, setBulkAction]         = useState('')   // 'status' | 'reassign' | 'tag'
  const [bulkStatus, setBulkStatus]         = useState('')
  const [bulkAgent, setBulkAgent]           = useState('')
  const [bulkTag, setBulkTag]               = useState('')
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [bulkWorking, setBulkWorking]       = useState(false)

  useEffect(() => {
    setPresets(loadPresets())
    try {
      const last = JSON.parse(localStorage.getItem(LAST_PRESET_KEY))
      if (last) setFilters(last)
    } catch {}
  }, [])

  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['tickets', filters, page, pageSize, company],
    queryFn: () => getTickets({ ...filters, limit: pageSize, offset: (page - 1) * pageSize, company }),
    refetchInterval: 30000,
  })
  const tickets    = ticketData?.tickets ?? (Array.isArray(ticketData) ? ticketData : [])
  const total      = ticketData?.total ?? tickets.length
  const totalPages = Math.ceil(total / pageSize)

  const holdMutation = useMutation({
    mutationFn: ({ id, action }) => holdTicket(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const { data: companies = [] }    = useQuery({ queryKey: ['companies'],     queryFn: getAdminCompanies, staleTime: 300000 })
  const { data: pocs = [] }         = useQuery({ queryKey: ['pocs', createForm.company_id], queryFn: () => getPOCs(createForm.company_id || undefined), enabled: showCreate, staleTime: 60000 })
  const { data: solutions = [] }    = useQuery({ queryKey: ['solutions', createForm.company_id], queryFn: () => getSolutions(createForm.company_id || undefined), enabled: showCreate, staleTime: 300000 })
  const { data: modules = [] }      = useQuery({ queryKey: ['modules'],       queryFn: () => getModules(),       staleTime: 300000 })
  const { data: requestTypes = [] } = useQuery({ queryKey: ['request-types'], queryFn: () => getRequestTypes(),  staleTime: 300000 })
  const { data: caseTypes = [] }    = useQuery({ queryKey: ['case-types'],    queryFn: () => getCaseTypes(),     staleTime: 300000 })
  const { data: allUsers = [] }     = useQuery({ queryKey: ['users'],          queryFn: getUsers,                 staleTime: 300000 })
  const { data: existingTags = [] } = useQuery({ queryKey: ['ticket-tags'],    queryFn: getTicketTags,            staleTime: 60000 })

  const createMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setShowCreate(false); setCreateForm(BLANK_TICKET); setCreateError('')
      toast.success('Ticket created')
    },
    onError: (e) => { setCreateError(e.message); toast.error(e.message || 'Failed to create ticket') },
  })

  const applyFilter = (key, value) => {
    const next = { ...filters, [key]: value }
    setFilters(next); setPage(1)
    localStorage.setItem(LAST_PRESET_KEY, JSON.stringify(next))
  }

  const loadPreset  = p => { setFilters(p.filters); localStorage.setItem(LAST_PRESET_KEY, JSON.stringify(p.filters)) }
  const savePreset  = () => {
    if (!presetName.trim()) return
    const updated = [...presets, { id: Date.now(), name: presetName.trim(), filters: { ...filters } }]
    setPresets(updated); savePresets(updated); setPresetName(''); setShowSaveForm(false)
  }
  const deletePreset = id => { const u = presets.filter(p => p.id !== id); setPresets(u); savePresets(u) }

  const filteredTickets = tickets?.filter(t => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return t.title?.toLowerCase().includes(term) || t.clickup_task_id?.toLowerCase().includes(term) || t.poc_name?.toLowerCase().includes(term)
  })

  const allOnPageSelected = filteredTickets?.length > 0 && filteredTickets.every(t => selectedIds.has(t.id))
  const someSelected = selectedIds.size > 0

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredTickets.forEach(t => next.delete(t.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredTickets.forEach(t => next.add(t.id))
        return next
      })
    }
  }

  const executeBulkAction = async () => {
    if (!selectedIds.size) return
    setBulkWorking(true)
    const ids = [...selectedIds]
    try {
      if (bulkAction === 'status' && bulkStatus) {
        await Promise.all(ids.map(id => updateTicket(id, { status: bulkStatus })))
        toast.success(`Status updated for ${ids.length} ticket${ids.length !== 1 ? 's' : ''}`)
      } else if (bulkAction === 'reassign' && bulkAgent) {
        await Promise.all(ids.map(id =>
          fetch(`/api/tickets/${id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignee_email: bulkAgent }),
          })
        ))
        toast.success(`Reassigned ${ids.length} ticket${ids.length !== 1 ? 's' : ''}`)
      } else if (bulkAction === 'tag' && bulkTag.trim()) {
        await Promise.all(ids.map(id => addTagToTicket(id, bulkTag.trim())))
        toast.success(`Tag added to ${ids.length} ticket${ids.length !== 1 ? 's' : ''}`)
      } else {
        toast.error('Please fill in the required field')
        setBulkWorking(false)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-tags'] })
      setSelectedIds(new Set())
      setBulkAction('')
      setBulkStatus(''); setBulkAgent(''); setBulkTag('')
    } catch (e) {
      toast.error(e.message || 'Bulk action failed')
    } finally {
      setBulkWorking(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Management</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">Tickets</h1>
        </div>
        <button onClick={() => { setShowCreate(true); setCreateError('') }} className="btn-primary">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* Filters card */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted" />
            <input
              type="text"
              placeholder="Search tickets…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select value={filters.priority}   onChange={e => applyFilter('priority', e.target.value)}   className="input">
            <option value="">All Priorities</option>
            <option value="P1">P1 — Critical</option>
            <option value="P2">P2 — High</option>
            <option value="P3">P3 — Medium</option>
            <option value="P4">P4 — Low</option>
          </select>
          <select value={filters.sla_status} onChange={e => applyFilter('sla_status', e.target.value)} className="input">
            <option value="">All SLA Status</option>
            <option value="critical">Critical</option>
            <option value="at_risk">At Risk</option>
            <option value="warning">Warning</option>
            <option value="healthy">Healthy</option>
          </select>
          <select value={filters.status}     onChange={e => applyFilter('status', e.target.value)}     className="input">
            <option value="">All Status</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Waiting">Waiting</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-2 flex-wrap border-t border-cortex-border pt-3">
          <span className="text-xs text-cortex-muted font-mono">Saved:</span>
          {presets.map(p => (
            <div key={p.id} className="flex items-center gap-1">
              <button
                onClick={() => loadPreset(p)}
                className="text-xs bg-cortex-surface-raised border border-cortex-border hover:border-cortex-accent text-cortex-text px-2.5 py-1 rounded-lg transition-colors"
              >
                {p.name}
              </button>
              <button onClick={() => deletePreset(p.id)} className="text-cortex-muted hover:text-cortex-danger transition-colors p-0.5">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {!showSaveForm ? (
            <button onClick={() => setShowSaveForm(true)} className="flex items-center gap-1 text-xs text-cortex-accent hover:underline">
              <Bookmark className="w-3 h-3" /> Save current
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Preset name…"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && savePreset()}
                className="input text-xs py-1 px-2 h-7 w-36"
                autoFocus
              />
              <button onClick={savePreset} className="btn-primary text-xs py-1 px-3">Save</button>
              <button onClick={() => setShowSaveForm(false)} className="text-xs text-cortex-muted hover:text-cortex-text">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cortex-border">
                <th className="table-header w-10">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center w-full text-cortex-muted hover:text-cortex-accent transition-colors">
                    {allOnPageSelected
                      ? <CheckSquare className="w-4 h-4 text-cortex-accent" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="table-header">
                  <div className="flex items-center gap-1.5">
                    Ticket
                    <NewBadge description="Channel tag (new) — 📞 Voice or ✉ Email badge on every ticket. Filter by channel using the Voice/Email tabs in My Tickets." />
                  </div>
                </th>
                <th className="table-header text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    Priority
                    <NewBadge description="Risk Badge (new) — AI-powered risk level combining sentiment analysis and escalation level. High Risk = negative sentiment + ESC 2+. Hover to learn more." />
                  </div>
                </th>
                <th className="table-header text-center">SLA</th>
                <th className="table-header text-center">Status</th>
                <th className="table-header">
                  <div className="flex items-center gap-1.5">
                    Reporter
                    <NewBadge description="VIP flag (new) — ⭐ marks contacts flagged as VIP in the Customers page. Manage VIP status under Customers in the sidebar." />
                  </div>
                </th>
                <th className="table-header">Created</th>
                <th className="table-header">In Status</th>
                <th className="table-header text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell" colSpan="9">
                      <div className="h-14 bg-cortex-bg animate-pulse rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : filteredTickets && filteredTickets.length > 0 ? (
                filteredTickets.map(ticket => {
                  const isPaused = !!ticket.sla_paused_at
                  const isActive = !['closed', 'resolved', 'complete', 'Closed', 'Resolved'].includes(ticket.status)
                  const isSelected = selectedIds.has(ticket.id)
                  return (
                    <tr key={ticket.id} className={`hover:bg-cortex-surface-raised transition-colors group ${isSelected ? 'bg-cortex-accent/5' : ''}`}>
                      <td className="table-cell w-10">
                        <button onClick={() => toggleSelect(ticket.id)} className="flex items-center justify-center w-full text-cortex-muted hover:text-cortex-accent transition-colors">
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-cortex-accent" />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="table-cell">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <div className="flex items-start gap-2">
                            {ticket.ai_sentiment && (
                              <span className="text-base leading-5 flex-shrink-0">{getSentimentEmoji(ticket.ai_sentiment)}</span>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {ticket.channel === 'voice'
                                  ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">📞 Voice</span>
                                  : ticket.channel === 'clickup'
                                  ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">🔗 ClickUp</span>
                                  : <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cortex-muted/10 text-cortex-muted border border-cortex-border">✉ Email</span>
                                }
                              </div>
                              <p className="font-medium text-cortex-text group-hover:text-cortex-accent transition-colors text-sm leading-snug">
                                {truncate(ticket.title, 55)}
                              </p>
                              <p className="text-xs text-cortex-muted font-mono">{ticket.clickup_task_id?.substring(0, 12)}</p>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="table-cell text-center">
                        <div className="flex flex-col items-center gap-1">
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
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`badge ${getSLAStatusColor(isPaused ? 'paused' : ticket.sla_status)}`}>
                            {isPaused ? 'paused' : ticket.sla_status}
                          </span>
                          {ticket.sla_consumption_pct !== null && (
                            <span className="text-xs font-mono text-cortex-muted">{ticket.sla_consumption_pct}%</span>
                          )}
                          {ticket.escalation_level > 0 && (
                            <span className="badge bg-cortex-danger/10 text-cortex-danger">ESC L{ticket.escalation_level}</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        <span className={`badge ${getStatusColor(ticket.status)}`}>{ticket.status}</span>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm font-medium text-cortex-text">{ticket.created_by_name || '—'}</p>
                        <p className="text-xs text-cortex-muted flex items-center gap-1">
                          {ticket.poc_email}
                          {ticket.poc_is_vip && <span title="VIP customer">⭐</span>}
                        </p>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-cortex-muted">{formatRelativeTime(ticket.created_at)}</span>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-cortex-muted font-mono">{formatRelativeTime(ticket.last_status_change_at || ticket.created_at)}</span>
                      </td>
                      <td className="table-cell text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/tickets/${ticket.id}`} className="btn-secondary text-xs px-3 py-1.5">View</Link>
                          {isActive && (
                            <button
                              onClick={() => holdMutation.mutate({ id: ticket.id, action: isPaused ? 'resume' : 'pause' })}
                              disabled={holdMutation.isPending}
                              title={isPaused ? 'Resume SLA' : 'Pause SLA'}
                              className="p-1.5 hover:bg-cortex-surface-raised rounded-lg transition-colors"
                            >
                              {isPaused
                                ? <PlayCircle  className="w-4 h-4 text-cortex-success" />
                                : <PauseCircle className="w-4 h-4 text-cortex-warning" />}
                            </button>
                          )}
                          <button
                            onClick={() => { setEscalateTarget(ticket.id); setEscalateLevel('1'); setEscalateReason('') }}
                            title="Escalate ticket"
                            className="p-1.5 hover:bg-cortex-surface-raised rounded-lg transition-colors"
                          >
                            <ArrowUpCircle className="w-4 h-4 text-cortex-warning" />
                          </button>
                          {ticket.clickup_url && (
                            <a href={ticket.clickup_url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 hover:bg-cortex-surface-raised rounded-lg transition-colors" title="Open in ClickUp">
                              <ExternalLink className="w-4 h-4 text-cortex-muted" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" className="table-cell text-center py-14 text-cortex-muted">
                    No tickets match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-cortex-muted">
          {total > 0
            ? `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)} of ${total} tickets`
            : '0 tickets'}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={e => { setPageSize(+e.target.value); setPage(1) }}
            className="input text-sm py-1.5 px-3 w-auto"
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary px-2 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-cortex-muted font-mono px-1">{page} / {totalPages || 1}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn-secondary px-2 py-1.5 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create ticket modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
              <h2 className="font-display font-bold text-cortex-text">New Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted hover:text-cortex-text transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); createMutation.mutate({ ...createForm, poc_id: createForm.poc_id || undefined, company_id: createForm.company_id || undefined }) }}
              className="p-6 space-y-4"
            >
              {createError && (
                <p className="text-sm text-cortex-danger bg-cortex-danger/8 border border-cortex-danger/20 rounded-xl px-3 py-2">{createError}</p>
              )}
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Title *</label>
                <input required value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} className="input" placeholder="Brief description of the issue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className="input min-h-[80px] resize-y" placeholder="Detailed description…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Priority</label>
                  <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))} className="input">
                    <option value="P1">P1 – Critical</option>
                    <option value="P2">P2 – High</option>
                    <option value="P3">P3 – Medium</option>
                    <option value="P4">P4 – Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Status</label>
                  <select value={createForm.status} onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))} className="input">
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Waiting</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Company</label>
                  <select value={createForm.company_id} onChange={e => setCreateForm(f => ({ ...f, company_id: e.target.value, poc_id: '', solution_id: '' }))} className="input">
                    <option value="">Select company…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Solution <span className="text-cortex-danger">*</span></label>
                  <select value={createForm.solution_id} onChange={e => setCreateForm(f => ({ ...f, solution_id: e.target.value }))} className="input" required>
                    <option value="">Select solution…</option>
                    {solutions.map(s => <option key={s.id} value={s.id}>{s.solution_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Reporter (POC)</label>
                <select value={createForm.poc_id} onChange={e => setCreateForm(f => ({ ...f, poc_id: e.target.value }))} className="input">
                  <option value="">Select POC…</option>
                  {pocs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Module</label>
                  <select value={createForm.module} onChange={e => setCreateForm(f => ({ ...f, module: e.target.value }))} className="input">
                    <option value="">—</option>
                    {modules.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Request Type</label>
                  <select value={createForm.request_type} onChange={e => setCreateForm(f => ({ ...f, request_type: e.target.value }))} className="input">
                    <option value="">—</option>
                    {requestTypes.map(rt => <option key={rt.id} value={rt.name}>{rt.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Case Type</label>
                  <select value={createForm.case_type} onChange={e => setCreateForm(f => ({ ...f, case_type: e.target.value }))} className="input">
                    <option value="">—</option>
                    {caseTypes.map(ct => <option key={ct.id} value={ct.name}>{ct.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Ticket'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary px-5">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk action floating bar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-in">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 min-w-[560px]">
            <span className="text-sm font-semibold text-cortex-text whitespace-nowrap">
              {selectedIds.size} selected
            </span>
            <div className="h-5 w-px bg-cortex-border" />

            {/* Action picker */}
            <div className="flex items-center gap-2 flex-1">
              <select
                value={bulkAction}
                onChange={e => { setBulkAction(e.target.value); setBulkStatus(''); setBulkAgent(''); setBulkTag('') }}
                className="input text-sm py-1.5 h-8 w-36"
              >
                <option value="">Action…</option>
                <option value="status">Change Status</option>
                <option value="reassign">Reassign</option>
                <option value="tag">Add Tag</option>
              </select>

              {bulkAction === 'status' && (
                <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="input text-sm py-1.5 h-8 w-36">
                  <option value="">Pick status…</option>
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Waiting</option>
                  <option>Resolved</option>
                  <option>Closed</option>
                </select>
              )}

              {bulkAction === 'reassign' && (
                <select value={bulkAgent} onChange={e => setBulkAgent(e.target.value)} className="input text-sm py-1.5 h-8 w-44">
                  <option value="">Pick agent…</option>
                  {allUsers.filter(u => u.is_active !== false).map(u => (
                    <option key={u.id} value={u.email}>{u.full_name || u.email}</option>
                  ))}
                </select>
              )}

              {bulkAction === 'tag' && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tag name…"
                    value={bulkTag}
                    onChange={e => {
                      setBulkTag(e.target.value)
                      const q = e.target.value.toLowerCase()
                      setTagSuggestions(q ? existingTags.filter(t => t.includes(q)).slice(0, 5) : [])
                    }}
                    className="input text-sm py-1.5 h-8 w-36"
                    list="tag-suggestions"
                  />
                  <datalist id="tag-suggestions">
                    {tagSuggestions.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              )}

              <button
                onClick={executeBulkAction}
                disabled={bulkWorking || !bulkAction}
                className="btn-primary text-sm py-1.5 px-4 h-8 disabled:opacity-40 flex items-center gap-1.5"
              >
                {bulkWorking
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Working…</>
                  : bulkAction === 'status' ? <><Tag className="w-3.5 h-3.5" /> Apply</>
                  : bulkAction === 'reassign' ? <><UserCheck className="w-3.5 h-3.5" /> Assign</>
                  : bulkAction === 'tag' ? <><Tag className="w-3.5 h-3.5" /> Add Tag</>
                  : 'Apply'}
              </button>
            </div>

            <button
              onClick={() => { setSelectedIds(new Set()); setBulkAction('') }}
              className="p-1 text-cortex-muted hover:text-cortex-text transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Escalation modal */}
      {escalateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-md animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
              <h2 className="font-display font-bold text-cortex-text flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-cortex-warning" /> Escalate Ticket
              </h2>
              <button onClick={() => setEscalateTarget(null)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted hover:text-cortex-text transition-colors">
                <X className="w-4 h-4" />
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
                  disabled={!escalateReason.trim() || escalating}
                  onClick={async () => {
                    if (!escalateReason.trim()) return
                    setEscalating(true)
                    try {
                      await fetch(`/api/tickets/${escalateTarget}/escalate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ level: parseInt(escalateLevel), reason: escalateReason.trim() }),
                      })
                      await addTicketNote(escalateTarget, { content: `Escalation reason (L${escalateLevel}): ${escalateReason.trim()}` })
                      queryClient.invalidateQueries({ queryKey: ['tickets'] })
                      toast.success(`Escalated to Level ${escalateLevel}`)
                      setEscalateTarget(null)
                    } catch (e) {
                      toast.error(e.message || 'Failed to escalate')
                    } finally {
                      setEscalating(false)
                    }
                  }}
                  className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {escalating ? 'Escalating…' : `Escalate to Level ${escalateLevel}`}
                </button>
                <button onClick={() => setEscalateTarget(null)} className="btn-secondary px-5">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
