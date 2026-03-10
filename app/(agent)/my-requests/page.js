'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { ClipboardList, FileText, Coffee, ArrowLeftRight, X, Clock, Plus, List, LayoutGrid, Calendar, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  getLeaveTypes, getLeaveRequests, createLeaveRequest,
  getBreakRequests, createBreakRequest,
  getShiftSwaps, createShiftSwap, respondToSwap,
  getUsers,
} from '@/lib/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

const STATUS_BADGE = {
  pending:           'bg-cortex-warning/15 text-cortex-warning',
  approved:          'bg-cortex-success/15 text-cortex-success',
  rejected:          'bg-cortex-danger/10 text-cortex-danger',
  accepted:          'bg-cortex-success/15 text-cortex-success',
  declined:          'bg-cortex-danger/10 text-cortex-danger',
  supervisor_review: 'bg-blue-400/15 text-blue-400',
  completed:         'bg-cortex-muted/20 text-cortex-muted',
}

// Left-border colors per request type
const TYPE_BORDER = {
  leave: 'border-l-blue-400',
  break: 'border-l-teal-400',
  swap:  'border-l-purple-400',
}

// Type labels + accent colors
const TYPE_CONFIG = {
  leave: { label: 'Leave',      icon: FileText,       color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  break: { label: 'Break',      icon: Coffee,         color: 'text-teal-400',   bg: 'bg-teal-400/10' },
  swap:  { label: 'Shift Swap', icon: ArrowLeftRight, color: 'text-purple-400', bg: 'bg-purple-400/10' },
}

function getItemStatus(item, type) {
  if (type === 'leave') return item.status
  if (type === 'break') return item.status
  if (type === 'swap') {
    if (item.supervisor_response && item.supervisor_response !== 'pending') return item.supervisor_response
    if (item.target_response === 'accepted') return 'supervisor_review'
    return item.target_response || 'pending'
  }
  return 'pending'
}

function getItemDates(item, type) {
  if (type === 'leave') {
    const from = item.start_date?.slice(0,10) || '—'
    const to   = item.end_date?.slice(0,10)   || '—'
    return from === to ? from : `${from} → ${to}`
  }
  if (type === 'break') {
    return item.shift_date
      ? `${item.shift_date?.slice(0,10)} · ${item.start_time?.slice(0,5)}–${item.end_time?.slice(0,5)}`
      : 'No shift linked'
  }
  if (type === 'swap') {
    return item.requester_shift_date
      ? `${item.requester_shift_date?.slice(0,10)} · ${item.requester_start?.slice(0,5)}–${item.requester_end?.slice(0,5)}`
      : '—'
  }
  return '—'
}

function getItemDetail(item, type) {
  if (type === 'leave') return item.leave_type ? item.leave_type.replace(/_/g, ' ') : '—'
  if (type === 'break') return `${item.duration_mins ?? '—'} min break`
  if (type === 'swap')  return item.target_agent_name ? `Swap with ${item.target_agent_name}` : '—'
  return '—'
}

function getItemNote(item, type) {
  if (type === 'leave' || type === 'break') return item.note || null
  if (type === 'swap') return item.note || null
  return null
}

// ─── KPI counts from unified list ────────────────────────────────────────────

function computeKPIs(items) {
  const pending  = items.filter(i => ['pending', 'supervisor_review'].includes(getItemStatus(i.item, i.type))).length
  const approved = items.filter(i => ['approved', 'accepted', 'completed'].includes(getItemStatus(i.item, i.type))).length
  const rejected = items.filter(i => ['rejected', 'declined'].includes(getItemStatus(i.item, i.type))).length
  return { total: items.length, pending, approved, rejected }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MyRequestsPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const today = fmt(new Date())

  // New unified modal state
  const [showNewModal, setShowNewModal] = useState(false)
  const [newModalType, setNewModalType] = useState('leave') // 'leave' | 'break' | 'swap'
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', leave_type: 'annual', note: '', is_partial: false, start_time: '', end_time: '' })
  const [breakForm, setBreakForm] = useState({ shift_id: '', duration_mins: 15, note: '' })
  const [swapForm, setSwapForm]   = useState({ my_shift_id: '', target_agent_id: '' })

  // Filter state
  const [typeFilter, setTypeFilter]     = useState('all')  // 'all' | 'leave' | 'break' | 'swap'
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]             = useState('')
  const [viewMode, setViewMode]         = useState('grid') // 'grid' | 'list'

  // ── Data queries ─────────────────────────────────────────────────────────

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: getLeaveTypes,
    staleTime: 3600000,
  })

  const { data: leaveRequests = [], isLoading: leaveLoading } = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: () => getLeaveRequests(false),
    staleTime: 60000,
  })

  const { data: breakRequests = [], isLoading: breakLoading } = useQuery({
    queryKey: ['my-break-requests'],
    queryFn: getBreakRequests,
    staleTime: 60000,
  })

  const { data: swapRequests = [], isLoading: swapLoading } = useQuery({
    queryKey: ['my-shift-swaps'],
    queryFn: () => getShiftSwaps(false),
    staleTime: 60000,
  })

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 300000,
  })

  const { data: myShifts = [] } = useQuery({
    queryKey: ['my-shifts-upcoming'],
    queryFn: () => fetch('/api/rota/me').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : []),
    staleTime: 300000,
  })

  const upcomingShifts = useMemo(() => myShifts.filter(s => s.shift_date >= today), [myShifts, today])
  const otherAgents    = allUsers.filter(u => u.is_active !== false && u.id !== session?.user?.id)

  const pendingSwaps = swapRequests.filter(
    s => s.target_agent_id === session?.user?.id && s.target_response === 'pending'
  )

  // Unified item list (tagged by type)
  const allItems = useMemo(() => [
    ...leaveRequests.map(item => ({ item, type: 'leave', createdAt: item.created_at || item.start_date || '' })),
    ...breakRequests.map(item => ({ item, type: 'break', createdAt: item.requested_at || item.created_at || '' })),
    ...swapRequests.filter(s => s.requester_id === session?.user?.id).map(item => ({ item, type: 'swap', createdAt: item.created_at || '' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [leaveRequests, breakRequests, swapRequests, session])

  // Filter
  const filtered = useMemo(() => allItems.filter(({ item, type }) => {
    if (typeFilter !== 'all' && type !== typeFilter) return false
    const status = getItemStatus(item, type)
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending'  && !['pending', 'supervisor_review'].includes(status)) return false
      if (statusFilter === 'approved' && !['approved', 'accepted', 'completed'].includes(status)) return false
      if (statusFilter === 'rejected' && !['rejected', 'declined'].includes(status)) return false
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      const detail = getItemDetail(item, type).toLowerCase()
      const dates  = getItemDates(item, type).toLowerCase()
      const note   = (getItemNote(item, type) || '').toLowerCase()
      if (!detail.includes(s) && !dates.includes(s) && !note.includes(s) && !type.includes(s)) return false
    }
    return true
  }), [allItems, typeFilter, statusFilter, search])

  const kpis = useMemo(() => computeKPIs(allItems), [allItems])
  const isLoading = leaveLoading || breakLoading || swapLoading

  // ── Submission handlers ──────────────────────────────────────────────────

  async function submitLeave(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = { ...leaveForm }
      if (!payload.is_partial) { delete payload.start_time; delete payload.end_time }
      delete payload.is_partial
      await createLeaveRequest(payload)
      toast.success('Leave request submitted')
      setShowNewModal(false)
      setLeaveForm({ start_date: '', end_date: '', leave_type: 'annual', note: '', is_partial: false, start_time: '', end_time: '' })
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] })
    } catch (err) {
      toast.error(err.message || 'Failed to submit')
    } finally { setSubmitting(false) }
  }

  async function submitBreak(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createBreakRequest({ ...breakForm, shift_id: breakForm.shift_id ? parseInt(breakForm.shift_id) : null })
      toast.success('Break request submitted')
      setShowNewModal(false)
      setBreakForm({ shift_id: '', duration_mins: 15, note: '' })
      qc.invalidateQueries({ queryKey: ['my-break-requests'] })
    } catch (err) {
      toast.error(err.message || 'Failed to submit')
    } finally { setSubmitting(false) }
  }

  async function submitSwap(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createShiftSwap({ requester_shift_id: parseInt(swapForm.my_shift_id), target_agent_id: parseInt(swapForm.target_agent_id) })
      toast.success('Swap request sent')
      setShowNewModal(false)
      setSwapForm({ my_shift_id: '', target_agent_id: '' })
      qc.invalidateQueries({ queryKey: ['my-shift-swaps'] })
    } catch (err) {
      toast.error(err.message || 'Failed to send')
    } finally { setSubmitting(false) }
  }

  async function respondSwap(swapId, response) {
    try {
      await respondToSwap(swapId, response)
      toast.success(response === 'accepted' ? 'Swap accepted' : 'Swap declined')
      qc.invalidateQueries({ queryKey: ['my-shift-swaps'] })
    } catch { toast.error('Failed to respond') }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Agent</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">My Requests</h1>
        </div>
        <button
          onClick={() => { setShowNewModal(true); setNewModalType('leave') }}
          className="flex items-center gap-2 btn-primary"
        >
          <Plus className="w-4 h-4" /> New Request
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: kpis.total,    color: 'text-cortex-text' },
          { label: 'Pending',  value: kpis.pending,  color: 'text-cortex-warning' },
          { label: 'Approved', value: kpis.approved, color: 'text-cortex-success' },
          { label: 'Rejected', value: kpis.rejected, color: 'text-cortex-danger' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card py-3 text-center">
            <p className={`text-2xl font-display font-bold ${color}`}>{isLoading ? '—' : value}</p>
            <p className="text-[10px] uppercase tracking-wide text-cortex-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Incoming swap alert */}
      {pendingSwaps.length > 0 && (
        <div className="card border-cortex-warning/30 bg-cortex-warning/5">
          <p className="text-sm font-semibold text-cortex-warning mb-3">
            {pendingSwaps.length} incoming swap request{pendingSwaps.length !== 1 ? 's' : ''} awaiting your response
          </p>
          <div className="space-y-2">
            {pendingSwaps.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-cortex-surface border border-cortex-border">
                <div>
                  <p className="text-xs font-medium text-cortex-text">{s.requester_name} wants to swap shifts</p>
                  <p className="text-[10px] text-cortex-muted">
                    Their shift: {s.requester_shift_date?.slice(0,10)} · {s.requester_start?.slice(0,5)}–{s.requester_end?.slice(0,5)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => respondSwap(s.id, 'accepted')} className="text-xs bg-cortex-success/15 text-cortex-success hover:bg-cortex-success/25 px-3 py-1.5 rounded-lg font-medium transition-colors">Accept</button>
                  <button onClick={() => respondSwap(s.id, 'declined')} className="text-xs bg-cortex-danger/10 text-cortex-danger hover:bg-cortex-danger/20 px-3 py-1.5 rounded-lg font-medium transition-colors">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type filter */}
        <div className="flex items-center gap-1 bg-cortex-surface border border-cortex-border rounded-lg p-1">
          {[
            { key: 'all',   label: 'All' },
            { key: 'leave', label: 'Leave' },
            { key: 'break', label: 'Break' },
            { key: 'swap',  label: 'Swaps' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
                typeFilter === key
                  ? 'bg-cortex-accent/15 text-cortex-accent'
                  : 'text-cortex-muted hover:text-cortex-text'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-xs py-1.5 w-36">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cortex-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search requests…"
            className="input text-xs py-1.5 pl-8 w-full"
          />
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1 border border-cortex-border rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-cortex-accent/15 text-cortex-accent' : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised')}
            title="Card view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('p-2 transition-colors', viewMode === 'list' ? 'bg-cortex-accent/15 text-cortex-accent' : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised')}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Result count */}
      {!isLoading && (
        <p className="text-xs text-cortex-muted font-mono">
          {filtered.length} request{filtered.length !== 1 ? 's' : ''}
          {(typeFilter !== 'all' || statusFilter !== 'all' || search) && ' (filtered)'}
        </p>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2'}>
          {[1,2,3].map(i => <div key={i} className="card animate-pulse h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-8 h-8 text-cortex-muted mx-auto mb-2 opacity-40" />
          <p className="text-sm text-cortex-muted">No requests found.</p>
          <button
            onClick={() => { setShowNewModal(true); setNewModalType('leave') }}
            className="mt-3 text-xs text-cortex-accent hover:underline"
          >
            Submit a new request →
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Card grid ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(({ item, type }, idx) => {
            const cfg    = TYPE_CONFIG[type]
            const Icon   = cfg.icon
            const status = getItemStatus(item, type)
            const dates  = getItemDates(item, type)
            const detail = getItemDetail(item, type)
            const note   = getItemNote(item, type)
            return (
              <div
                key={`${type}-${item.id ?? idx}`}
                className={cn('card border-l-4 flex flex-col gap-3', TYPE_BORDER[type])}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold', cfg.bg, cfg.color)}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </div>
                  <span className={cn('badge text-[10px] capitalize', STATUS_BADGE[status] || 'bg-cortex-surface text-cortex-muted')}>
                    {status?.replace(/_/g, ' ')}
                  </span>
                </div>
                {/* Main detail */}
                <div>
                  <p className="text-sm font-semibold text-cortex-text capitalize">{detail}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-cortex-muted">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span className="font-mono">{dates}</span>
                  </div>
                </div>
                {/* Note */}
                {note && (
                  <p className="text-[11px] text-cortex-muted line-clamp-2 italic">"{note}"</p>
                )}
                {/* Footer */}
                <div className="mt-auto flex items-center justify-between text-[10px] text-cortex-muted pt-2 border-t border-cortex-border">
                  <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—'}</span>
                  {type === 'leave' && item.zoho_people_record_id && (
                    <span className="text-cortex-success">Zoho synced ✓</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Table list ── */
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cortex-border">
                  <th className="table-header">Type</th>
                  <th className="table-header">Detail</th>
                  <th className="table-header">Dates / Shift</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Note</th>
                  <th className="table-header">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cortex-border">
                {filtered.map(({ item, type }, idx) => {
                  const cfg    = TYPE_CONFIG[type]
                  const Icon   = cfg.icon
                  const status = getItemStatus(item, type)
                  return (
                    <tr key={`${type}-${item.id ?? idx}`} className="hover:bg-cortex-surface-raised transition-colors">
                      <td className="table-cell">
                        <div className={cn('flex items-center gap-1.5 text-xs font-semibold w-fit px-2 py-1 rounded-lg', cfg.bg, cfg.color)}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </div>
                      </td>
                      <td className="table-cell text-xs capitalize">{getItemDetail(item, type)}</td>
                      <td className="table-cell text-xs font-mono text-cortex-muted">{getItemDates(item, type)}</td>
                      <td className="table-cell">
                        <span className={cn('badge text-[10px] capitalize', STATUS_BADGE[status] || 'bg-cortex-surface text-cortex-muted')}>
                          {status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="table-cell text-[11px] text-cortex-muted max-w-[160px] truncate">
                        {getItemNote(item, type) || '—'}
                      </td>
                      <td className="table-cell text-[11px] text-cortex-muted">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Unified New Request Modal ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-md animate-slide-in">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
              <h2 className="font-display font-bold text-cortex-text text-sm">New Request</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type selector */}
              <div>
                <p className="text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-2">Request Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewModalType(key)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all',
                          newModalType === key
                            ? `${cfg.bg} ${cfg.color} border-current`
                            : 'text-cortex-muted border-cortex-border hover:border-cortex-accent/30 hover:text-cortex-text'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Leave form */}
              {newModalType === 'leave' && (
                <form onSubmit={submitLeave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">From *</label>
                      <input type="date" required value={leaveForm.start_date}
                        onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                        className="input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">To *</label>
                      <input type="date" required value={leaveForm.end_date}
                        onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                        className="input w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Leave Type *</label>
                    <select value={leaveForm.leave_type}
                      onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                      className="input w-full">
                      {leaveTypes.length > 0
                        ? leaveTypes.map(lt => <option key={lt.zoho_type_id} value={lt.zoho_type_id}>{lt.name}</option>)
                        : <>
                            <option value="annual">Annual Leave</option>
                            <option value="sick">Sick Leave</option>
                            <option value="other">Other</option>
                          </>
                      }
                    </select>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={leaveForm.is_partial}
                      onChange={e => setLeaveForm(f => ({ ...f, is_partial: e.target.checked }))}
                      className="rounded" />
                    <span className="text-sm text-cortex-text">Partial day (specify hours)</span>
                  </label>
                  {leaveForm.is_partial && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-cortex-bg rounded-xl border border-cortex-border">
                      <div>
                        <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">From Time *</label>
                        <input type="time" required value={leaveForm.start_time}
                          onChange={e => setLeaveForm(f => ({ ...f, start_time: e.target.value }))}
                          className="input w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">To Time *</label>
                        <input type="time" required value={leaveForm.end_time}
                          onChange={e => setLeaveForm(f => ({ ...f, end_time: e.target.value }))}
                          className="input w-full" />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Note (optional)</label>
                    <textarea value={leaveForm.note}
                      onChange={e => setLeaveForm(f => ({ ...f, note: e.target.value }))}
                      className="input w-full min-h-[60px] resize-y text-sm"
                      placeholder="Additional context…" />
                  </div>
                  <ModalActions submitting={submitting} onCancel={() => setShowNewModal(false)} label="Submit Leave Request" />
                </form>
              )}

              {/* Break form */}
              {newModalType === 'break' && (
                <form onSubmit={submitBreak} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">For Shift (optional)</label>
                    <select value={breakForm.shift_id}
                      onChange={e => setBreakForm(f => ({ ...f, shift_id: e.target.value }))}
                      className="input w-full">
                      <option value="">— Select a shift —</option>
                      {upcomingShifts.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.shift_date?.slice(0,10)} · {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Duration *</label>
                    <div className="flex gap-2">
                      {[15, 30, 45, 60].map(m => (
                        <button key={m} type="button"
                          onClick={() => setBreakForm(f => ({ ...f, duration_mins: m }))}
                          className={cn(
                            'flex-1 py-2 text-sm rounded-lg border transition-colors',
                            breakForm.duration_mins === m
                              ? 'bg-cortex-accent/15 border-cortex-accent text-cortex-accent font-semibold'
                              : 'border-cortex-border text-cortex-muted hover:border-cortex-accent/50'
                          )}
                        >
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Note (optional)</label>
                    <input value={breakForm.note}
                      onChange={e => setBreakForm(f => ({ ...f, note: e.target.value }))}
                      className="input w-full" placeholder="Reason or context…" />
                  </div>
                  <ModalActions submitting={submitting} onCancel={() => setShowNewModal(false)} label="Submit Break Request" />
                </form>
              )}

              {/* Swap form */}
              {newModalType === 'swap' && (
                <form onSubmit={submitSwap} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">My Shift *</label>
                    <select required value={swapForm.my_shift_id}
                      onChange={e => setSwapForm(f => ({ ...f, my_shift_id: e.target.value }))}
                      className="input w-full">
                      <option value="">Select one of your upcoming shifts…</option>
                      {upcomingShifts.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.shift_date?.slice(0,10)} · {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Swap with *</label>
                    <select required value={swapForm.target_agent_id}
                      onChange={e => setSwapForm(f => ({ ...f, target_agent_id: e.target.value }))}
                      className="input w-full">
                      <option value="">Select an agent…</option>
                      {otherAgents.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-cortex-muted bg-cortex-bg rounded-xl px-3 py-2">
                    The agent will be notified and must accept before a supervisor reviews.
                  </p>
                  <ModalActions submitting={submitting} onCancel={() => setShowNewModal(false)} label="Send Swap Request" />
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModalActions({ submitting, onCancel, label }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-40">
        {submitting ? 'Submitting…' : label}
      </button>
      <button type="button" onClick={onCancel} className="btn-secondary px-5">Cancel</button>
    </div>
  )
}
