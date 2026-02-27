'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTickets, holdTicket, getAdminCompanies, getPOCs, getModules, getRequestTypes, getCaseTypes, createTicket } from '@/lib/api'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { getSLAStatusColor, getPriorityColor, getStatusColor, formatRelativeTime, truncate, getSentimentEmoji } from '@/lib/utils'
import { Search, ExternalLink, Bookmark, Trash2, PauseCircle, PlayCircle, Plus, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

const PRESETS_KEY     = 'cortex_filter_presets'
const LAST_PRESET_KEY = 'cortex_last_preset'

function loadPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]') } catch { return [] }
}
function savePresets(p) { localStorage.setItem(PRESETS_KEY, JSON.stringify(p)) }

const BLANK_TICKET = { title: '', description: '', priority: 'P3', status: 'Open', module: '', request_type: '', case_type: '', poc_id: '', company_id: '' }

export default function TicketsPage() {
  const queryClient = useQueryClient()
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

  useEffect(() => {
    setPresets(loadPresets())
    try {
      const last = JSON.parse(localStorage.getItem(LAST_PRESET_KEY))
      if (last) setFilters(last)
    } catch {}
  }, [])

  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['tickets', filters, page, pageSize],
    queryFn: () => getTickets({ ...filters, limit: pageSize, offset: (page - 1) * pageSize }),
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
  const { data: modules = [] }      = useQuery({ queryKey: ['modules'],       queryFn: getModules,       staleTime: 300000 })
  const { data: requestTypes = [] } = useQuery({ queryKey: ['request-types'], queryFn: getRequestTypes,  staleTime: 300000 })
  const { data: caseTypes = [] }    = useQuery({ queryKey: ['case-types'],    queryFn: getCaseTypes,     staleTime: 300000 })

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
                <th className="table-header">Ticket</th>
                <th className="table-header text-center">Priority</th>
                <th className="table-header text-center">SLA</th>
                <th className="table-header text-center">Status</th>
                <th className="table-header">Reporter</th>
                <th className="table-header">Created</th>
                <th className="table-header">In Status</th>
                <th className="table-header text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell" colSpan="8">
                      <div className="h-14 bg-cortex-bg animate-pulse rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : filteredTickets && filteredTickets.length > 0 ? (
                filteredTickets.map(ticket => {
                  const isPaused = !!ticket.sla_paused_at
                  const isActive = !['closed', 'resolved', 'complete', 'Closed', 'Resolved'].includes(ticket.status)
                  return (
                    <tr key={ticket.id} className="hover:bg-cortex-surface-raised transition-colors group">
                      <td className="table-cell">
                        <Link href={`/tickets/${ticket.id}`} className="block">
                          <div className="flex items-start gap-2">
                            {ticket.ai_sentiment && (
                              <span className="text-base leading-5 flex-shrink-0">{getSentimentEmoji(ticket.ai_sentiment)}</span>
                            )}
                            <div>
                              <p className="font-medium text-cortex-text group-hover:text-cortex-accent transition-colors text-sm leading-snug mb-0.5">
                                {truncate(ticket.title, 55)}
                              </p>
                              <p className="text-xs text-cortex-muted font-mono">{ticket.clickup_task_id?.substring(0, 12)}</p>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="table-cell text-center">
                        <span className={`badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
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
                        <p className="text-xs text-cortex-muted">{ticket.poc_email}</p>
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
                  <td colSpan="8" className="table-cell text-center py-14 text-cortex-muted">
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
                  <select value={createForm.company_id} onChange={e => setCreateForm(f => ({ ...f, company_id: e.target.value, poc_id: '' }))} className="input">
                    <option value="">Select company…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Reporter (POC)</label>
                  <select value={createForm.poc_id} onChange={e => setCreateForm(f => ({ ...f, poc_id: e.target.value }))} className="input">
                    <option value="">Select POC…</option>
                    {pocs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
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
    </div>
  )
}
