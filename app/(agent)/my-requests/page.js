'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { ClipboardList, FileText, Coffee, ArrowLeftRight, X, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getLeaveRequests, createLeaveRequest,
  getBreakRequests, createBreakRequest,
  getShiftSwaps, createShiftSwap, respondToSwap,
  getUsers,
} from '@/lib/api'

function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

const STATUS_BADGE = {
  pending:  'bg-cortex-warning/15 text-cortex-warning',
  approved: 'bg-cortex-success/15 text-cortex-success',
  rejected: 'bg-cortex-danger/10 text-cortex-danger',
  accepted: 'bg-cortex-success/15 text-cortex-success',
  declined: 'bg-cortex-danger/10 text-cortex-danger',
  supervisor_review: 'bg-blue-400/15 text-blue-400',
  completed: 'bg-cortex-muted/20 text-cortex-muted',
}

export default function MyRequestsPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const today = fmt(new Date())

  const [tab, setTab] = useState('leave')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showBreakModal, setShowBreakModal] = useState(false)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', leave_type: 'annual', note: '', is_partial: false, start_time: '', end_time: '' })
  const [breakForm, setBreakForm] = useState({ shift_id: '', duration_mins: 15, note: '' })
  const [swapForm, setSwapForm] = useState({ my_shift_id: '', target_agent_id: '' })

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

  // My upcoming shifts for break & swap forms
  const { data: myShifts = [] } = useQuery({
    queryKey: ['my-shifts-upcoming'],
    queryFn: () => fetch(`/api/rota/me`).then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : []),
    staleTime: 300000,
  })

  const upcomingShifts = useMemo(() =>
    myShifts.filter(s => s.shift_date >= today),
    [myShifts, today]
  )

  const pendingSwaps = swapRequests.filter(
    s => s.target_agent_id === session?.user?.id && s.target_response === 'pending'
  )
  const mySwaps = swapRequests.filter(
    s => s.requester_id === session?.user?.id || s.target_agent_id !== session?.user?.id
  )

  const otherAgents = allUsers.filter(u => u.is_active !== false && u.id !== session?.user?.id)

  async function submitLeave(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = { ...leaveForm }
      if (!payload.is_partial) { delete payload.start_time; delete payload.end_time }
      delete payload.is_partial
      await createLeaveRequest(payload)
      toast.success('Leave request submitted')
      setShowLeaveModal(false)
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
      setShowBreakModal(false)
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
      setShowSwapModal(false)
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

  const TABS = [
    { key: 'leave',  label: 'Leave',       count: leaveRequests.length,  loading: leaveLoading },
    { key: 'break',  label: 'Breaks',      count: breakRequests.length,  loading: breakLoading },
    { key: 'swap',   label: 'Shift Swaps', count: swapRequests.length,   loading: swapLoading, badge: pendingSwaps.length },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Agent</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-cortex-accent" />
            My Requests
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLeaveModal(true)} className="btn-secondary text-xs flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Request Leave
          </button>
          <button onClick={() => setShowBreakModal(true)} className="btn-secondary text-xs flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5" /> Request Break
          </button>
          <button onClick={() => setShowSwapModal(true)} className="btn-secondary text-xs flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Request Swap
          </button>
        </div>
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-cortex-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              tab === t.key ? 'text-cortex-accent border-b-2 border-cortex-accent -mb-px' : 'text-cortex-muted hover:text-cortex-text'
            }`}
          >
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-md ${tab === t.key ? 'bg-cortex-accent/15 text-cortex-accent' : 'bg-cortex-surface text-cortex-muted'}`}>
              {t.count}
            </span>
            {t.badge > 0 && (
              <span className="w-4 h-4 flex items-center justify-center bg-cortex-warning text-white text-[9px] font-bold rounded-full">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leave requests */}
      {tab === 'leave' && (
        leaveLoading ? <LoadingSkeleton /> :
        leaveRequests.length === 0 ? <EmptyState label="No leave requests yet" /> : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header">Dates</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Days</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Note</th>
                  <th className="table-header">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map(lr => {
                  const days = lr.start_date && lr.end_date
                    ? Math.round((new Date(lr.end_date) - new Date(lr.start_date)) / 86400000) + 1
                    : '—'
                  return (
                    <tr key={lr.id} className="border-b border-cortex-border hover:bg-cortex-bg/40 transition-colors">
                      <td className="table-cell font-mono text-xs">{lr.start_date?.slice(0,10)} → {lr.end_date?.slice(0,10)}</td>
                      <td className="table-cell capitalize">{lr.leave_type}</td>
                      <td className="table-cell text-cortex-muted">{days}</td>
                      <td className="table-cell">
                        <span className={`badge text-xs capitalize ${STATUS_BADGE[lr.status] || 'bg-cortex-surface text-cortex-muted'}`}>
                          {lr.status}
                        </span>
                      </td>
                      <td className="table-cell text-cortex-muted text-xs max-w-[200px] truncate">{lr.note || '—'}</td>
                      <td className="table-cell text-cortex-muted text-xs">
                        {lr.created_at ? new Date(lr.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Break requests */}
      {tab === 'break' && (
        breakLoading ? <LoadingSkeleton /> :
        breakRequests.length === 0 ? <EmptyState label="No break requests yet" /> : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header">Shift</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Note</th>
                  <th className="table-header">Requested</th>
                </tr>
              </thead>
              <tbody>
                {breakRequests.map(br => (
                  <tr key={br.id} className="border-b border-cortex-border hover:bg-cortex-bg/40 transition-colors">
                    <td className="table-cell text-xs text-cortex-muted font-mono">
                      {br.shift_date ? `${br.shift_date?.slice(0,10)} · ${br.start_time?.slice(0,5)}–${br.end_time?.slice(0,5)}` : '—'}
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-cortex-accent/10 text-cortex-accent">{br.duration_mins} min</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge text-xs capitalize ${STATUS_BADGE[br.status] || 'bg-cortex-surface text-cortex-muted'}`}>
                        {br.status}
                      </span>
                    </td>
                    <td className="table-cell text-cortex-muted text-xs">{br.note || '—'}</td>
                    <td className="table-cell text-cortex-muted text-xs">
                      {br.requested_at ? new Date(br.requested_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Swap requests */}
      {tab === 'swap' && (
        swapLoading ? <LoadingSkeleton /> :
        mySwaps.length === 0 ? <EmptyState label="No swap requests yet" /> : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header">My Shift</th>
                  <th className="table-header">With Agent</th>
                  <th className="table-header">Agent Response</th>
                  <th className="table-header">Supervisor</th>
                  <th className="table-header">Requested</th>
                </tr>
              </thead>
              <tbody>
                {mySwaps.map(s => (
                  <tr key={s.id} className="border-b border-cortex-border hover:bg-cortex-bg/40 transition-colors">
                    <td className="table-cell text-xs font-mono text-cortex-muted">
                      {s.requester_shift_date?.slice(0,10)} · {s.requester_start?.slice(0,5)}–{s.requester_end?.slice(0,5)}
                    </td>
                    <td className="table-cell text-cortex-text">{s.target_agent_name || '—'}</td>
                    <td className="table-cell">
                      <span className={`badge text-xs capitalize ${STATUS_BADGE[s.target_response] || 'bg-cortex-surface text-cortex-muted'}`}>
                        {s.target_response}
                      </span>
                    </td>
                    <td className="table-cell">
                      {s.supervisor_response ? (
                        <span className={`badge text-xs capitalize ${STATUS_BADGE[s.supervisor_response] || ''}`}>
                          {s.supervisor_response}
                        </span>
                      ) : <span className="text-cortex-muted text-xs">—</span>}
                    </td>
                    <td className="table-cell text-cortex-muted text-xs">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Leave modal */}
      {showLeaveModal && (
        <Modal title="Request Leave" icon={<FileText className="w-4 h-4 text-cortex-accent" />} onClose={() => setShowLeaveModal(false)}>
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
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="other">Other</option>
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
                className="input w-full min-h-[70px] resize-y text-sm"
                placeholder="Additional context…" />
            </div>
            <ModalActions submitting={submitting} onCancel={() => setShowLeaveModal(false)} label="Submit Request" />
          </form>
        </Modal>
      )}

      {/* Break modal */}
      {showBreakModal && (
        <Modal title="Request Break" icon={<Coffee className="w-4 h-4 text-cortex-accent" />} onClose={() => setShowBreakModal(false)}>
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
                    className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                      breakForm.duration_mins === m
                        ? 'bg-cortex-accent/15 border-cortex-accent text-cortex-accent font-semibold'
                        : 'border-cortex-border text-cortex-muted hover:border-cortex-accent/50'
                    }`}
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
            <ModalActions submitting={submitting} onCancel={() => setShowBreakModal(false)} label="Submit Break Request" />
          </form>
        </Modal>
      )}

      {/* Swap modal */}
      {showSwapModal && (
        <Modal title="Request Shift Swap" icon={<ArrowLeftRight className="w-4 h-4 text-cortex-accent" />} onClose={() => setShowSwapModal(false)}>
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
                {otherAgents.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-cortex-muted bg-cortex-bg rounded-xl px-3 py-2">
              The agent will be notified and must accept before a supervisor reviews.
            </p>
            <ModalActions submitting={submitting} onCancel={() => setShowSwapModal(false)} label="Send Swap Request" />
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-md animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
          <h2 className="font-display font-bold text-cortex-text text-sm flex items-center gap-2">
            {icon} {title}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
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

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-cortex-surface animate-pulse rounded-xl" />)}
    </div>
  )
}

function EmptyState({ label }) {
  return (
    <div className="card text-center py-10">
      <Clock className="w-8 h-8 text-cortex-muted mx-auto mb-2 opacity-40" />
      <p className="text-sm text-cortex-muted">{label}</p>
    </div>
  )
}

