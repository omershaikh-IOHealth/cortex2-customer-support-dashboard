'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { BookOpen, Info, Calendar, Clock, Coffee, ChevronLeft, ChevronRight, Zap, CheckCircle, FileText, ArrowLeftRight, X } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'
import { useState, useMemo } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { getCirculars, getLeaveRequests, createLeaveRequest, getShiftSwaps, createShiftSwap, respondToSwap, getUsers } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getWeekDates(base) {
  const d = new Date(base)
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function BriefingPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const [weekBase, setWeekBase] = useState(new Date())
  const [acking, setAcking] = useState(false)

  // Leave request state
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', leave_type: 'annual', note: '' })
  const [submittingLeave, setSubmittingLeave] = useState(false)

  // Swap request state
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapTargetAgent, setSwapTargetAgent] = useState('')
  const [swapMyShiftId, setSwapMyShiftId] = useState('')
  const [submittingSwap, setSubmittingSwap] = useState(false)
  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase])
  const from = fmt(weekDates[0])
  const to   = fmt(weekDates[6])

  const { data: circulars = [], isLoading: circLoading } = useQuery({
    queryKey: ['circulars'],
    queryFn: getCirculars,
    refetchInterval: 300000,
  })
  const { data: shifts = [] } = useQuery({
    queryKey: ['my-rota', from, to],
    queryFn: () => fetch(`/api/rota?from=${from}&to=${to}`).then(r => r.ok ? r.json() : []),
    refetchInterval: 300000,
  })

  const activeCirculars = circulars.filter(c => c.is_active)
  const shiftsByDate = useMemo(() => {
    const map = {}
    for (const s of shifts) {
      const key = typeof s.shift_date === 'string' ? s.shift_date.slice(0, 10) : fmt(new Date(s.shift_date))
      map[key] = s
    }
    return map
  }, [shifts])

  const today = fmt(new Date())
  const todayShift = shiftsByDate[today]
  const firstName = session?.user?.name?.split(' ')[0] || 'Agent'

  const { data: ackData } = useQuery({
    queryKey: ['briefing-ack', todayShift?.id],
    queryFn: () => fetch(`/api/briefing/acknowledge?shift_id=${todayShift.id}`).then(r => r.ok ? r.json() : { acked: false }),
    enabled: !!todayShift?.id,
  })

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: () => getLeaveRequests(false),
    staleTime: 60000,
  })

  const { data: swapRequests = [] } = useQuery({
    queryKey: ['my-shift-swaps'],
    queryFn: () => getShiftSwaps(false),
    staleTime: 60000,
  })

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 300000,
  })

  const pendingSwaps = swapRequests.filter(
    s => s.target_agent_id === session?.user?.id && s.target_response === 'pending'
  )

  async function handleSubmitLeave(e) {
    e.preventDefault()
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.leave_type) return
    setSubmittingLeave(true)
    try {
      await createLeaveRequest(leaveForm)
      toast.success('Leave request submitted')
      setShowLeaveModal(false)
      setLeaveForm({ start_date: '', end_date: '', leave_type: 'annual', note: '' })
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] })
    } catch (err) {
      toast.error(err.message || 'Failed to submit leave request')
    } finally {
      setSubmittingLeave(false)
    }
  }

  async function handleSubmitSwap(e) {
    e.preventDefault()
    if (!swapMyShiftId || !swapTargetAgent) return
    setSubmittingSwap(true)
    try {
      await createShiftSwap({ requester_shift_id: parseInt(swapMyShiftId), target_agent_id: parseInt(swapTargetAgent) })
      toast.success('Swap request sent')
      setShowSwapModal(false)
      setSwapMyShiftId(''); setSwapTargetAgent('')
      qc.invalidateQueries({ queryKey: ['my-shift-swaps'] })
    } catch (err) {
      toast.error(err.message || 'Failed to send swap request')
    } finally {
      setSubmittingSwap(false)
    }
  }

  async function handleRespondSwap(swapId, response) {
    try {
      await respondToSwap(swapId, response)
      toast.success(response === 'accepted' ? 'Swap accepted — awaiting supervisor' : 'Swap declined')
      qc.invalidateQueries({ queryKey: ['my-shift-swaps'] })
    } catch (err) {
      toast.error(err.message || 'Failed to respond')
    }
  }

  async function handleAcknowledge() {
    if (!todayShift?.id || acking) return
    setAcking(true)
    try {
      await fetch('/api/briefing/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: todayShift.id }),
      })
      qc.invalidateQueries({ queryKey: ['briefing-ack', todayShift.id] })
    } finally {
      setAcking(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Hero greeting */}
      <div className="card bg-gradient-to-br from-cortex-accent/8 via-cortex-surface to-cortex-surface border-cortex-accent/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-cortex-accent uppercase tracking-widest mb-1">{getGreeting()}</p>
            <h1 className="text-2xl font-display font-bold text-cortex-text mb-1">{firstName}</h1>
            <p className="text-sm text-cortex-muted">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <Zap className="w-8 h-8 text-cortex-accent/40 flex-shrink-0 mt-1" />
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Account info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-cortex-accent" />
            <h2 className="font-semibold text-cortex-text text-sm">Account Info</h2>
          </div>
          <div className="space-y-0">
            {[
              { label: 'Queue',   value: 'iohealth' },
              { label: 'Role',    value: session?.user?.role,      badge: true  },
              { label: 'ZIWO',    value: session?.user?.ziwoEmail || 'Not linked', mono: true },
            ].map(({ label, value, badge, mono }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-cortex-border last:border-0">
                <span className="text-xs text-cortex-muted">{label}</span>
                {badge
                  ? <span className="badge bg-cortex-success/10 text-cortex-success capitalize">{value}</span>
                  : <span className={`text-xs ${mono ? 'font-mono' : 'font-medium'} text-cortex-text truncate max-w-[140px]`}>{value}</span>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Today's shift */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-cortex-accent" />
            <h2 className="font-semibold text-cortex-text text-sm">Today's Shift</h2>
          </div>
          {todayShift ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="badge bg-cortex-accent/10 text-cortex-accent font-mono">
                  {todayShift.start_time?.slice(0, 5)} – {todayShift.end_time?.slice(0, 5)}
                </span>
                {todayShift.shift_type !== 'regular' && (
                  <span className="badge bg-cortex-warning/10 text-cortex-warning capitalize">{todayShift.shift_type}</span>
                )}
              </div>
              {todayShift.breaks?.length > 0 && (
                <div className="space-y-1">
                  {todayShift.breaks.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-cortex-muted">
                      <Coffee className="w-3 h-3 text-cortex-warning flex-shrink-0" />
                      <span className="font-mono">{b.break_start?.slice(0, 5)} – {b.break_end?.slice(0, 5)}</span>
                      <span className="text-cortex-border">·</span>
                      <span className="capitalize">{b.break_type || 'break'}</span>
                    </div>
                  ))}
                </div>
              )}
              {todayShift.notes && (
                <p className="text-xs text-cortex-muted border-t border-cortex-border pt-2">{todayShift.notes}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-cortex-muted">No shift scheduled for today</p>
          )}
        </div>

        {/* Circulars counter */}
        <div className="card flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-cortex-success" />
            <h2 className="font-semibold text-cortex-text text-sm">Active Circulars</h2>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-5xl font-display font-bold text-cortex-text">{activeCirculars.length}</p>
              <p className="text-xs text-cortex-muted mt-1">published · scroll to read</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly schedule */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cortex-accent" />
            <h2 className="font-semibold text-cortex-text text-sm">My Schedule</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d) }}
              className="btn-secondary p-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-cortex-muted font-mono">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' — '}
              {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d) }}
              className="btn-secondary p-1.5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weekDates.map(date => {
            const key    = fmt(date)
            const shift  = shiftsByDate[key]
            const isToday = key === today
            return (
              <div
                key={key}
                className={cn(
                  'rounded-xl border p-2 min-h-[96px] flex flex-col transition-colors',
                  isToday
                    ? 'border-cortex-accent bg-cortex-accent/5'
                    : 'border-cortex-border hover:border-cortex-border-strong'
                )}
              >
                <div className="text-center mb-2">
                  <p className="text-[10px] text-cortex-muted uppercase tracking-wider">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={cn('text-sm font-bold', isToday ? 'text-cortex-accent' : 'text-cortex-text')}>
                    {date.getDate()}
                  </p>
                </div>
                {shift ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-cortex-text font-mono">
                      <Clock className="w-2.5 h-2.5 text-cortex-muted flex-shrink-0" />
                      {shift.start_time?.slice(0, 5)}–{shift.end_time?.slice(0, 5)}
                    </div>
                    {shift.breaks?.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px] text-cortex-warning">
                        <Coffee className="w-2.5 h-2.5 flex-shrink-0" />
                        {b.break_start?.slice(0, 5)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-cortex-muted text-center mt-auto mb-2">—</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Circulars */}
      <div>
        <h2 className="font-semibold text-cortex-text mb-3 flex items-center gap-2 text-sm">
          <BookOpen className="w-4 h-4 text-cortex-success" />
          Circulars &amp; Knowledge Updates
        </h2>
        {circLoading ? (
          <div className="card animate-pulse h-24" />
        ) : activeCirculars.length === 0 ? (
          <div className="card text-center py-10">
            <BookOpen className="w-8 h-8 text-cortex-muted mx-auto mb-2 opacity-40" />
            <p className="text-sm text-cortex-muted">No circulars published yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeCirculars.map(c => (
              <div key={c.id} className="card hover:border-cortex-accent/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-cortex-text mb-1 truncate">{c.title}</p>
                    <p className="text-sm text-cortex-muted line-clamp-2 leading-relaxed">{c.content}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {c.category && <span className="badge bg-cortex-accent/10 text-cortex-accent">{c.category}</span>}
                      {c.tags?.map(tag => <span key={tag} className="badge bg-cortex-surface-raised text-cortex-muted">#{tag}</span>)}
                    </div>
                  </div>
                  <span className="text-xs text-cortex-muted font-mono flex-shrink-0">{formatRelativeTime(c.updated_at || c.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leave & Swap requests */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-cortex-text text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-cortex-accent" />
            My Requests
            <NewBadge description="New — submit leave requests and shift swap requests from this page. Accept or decline incoming swap requests from teammates." />
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeaveModal(true)}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> Request Leave
            </button>
            <button
              onClick={() => setShowSwapModal(true)}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> Request Swap
            </button>
          </div>
        </div>

        {/* Pending swap requests targeting this agent */}
        {pendingSwaps.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-cortex-warning uppercase tracking-wider font-semibold">
              {pendingSwaps.length} incoming swap request{pendingSwaps.length !== 1 ? 's' : ''}
            </p>
            {pendingSwaps.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-cortex-warning/5 border border-cortex-warning/20">
                <div>
                  <p className="text-xs font-medium text-cortex-text">
                    {s.requester_name} wants to swap shifts
                  </p>
                  <p className="text-[10px] text-cortex-muted">
                    Their shift: {s.requester_shift_date?.slice(0, 10)} {s.requester_start?.slice(0, 5)}–{s.requester_end?.slice(0, 5)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRespondSwap(s.id, 'accepted')}
                    className="text-xs bg-cortex-success/15 text-cortex-success hover:bg-cortex-success/25 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespondSwap(s.id, 'declined')}
                    className="text-xs bg-cortex-danger/10 text-cortex-danger hover:bg-cortex-danger/20 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* My recent requests */}
        {leaveRequests.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-cortex-muted uppercase tracking-wider font-semibold">My leave requests</p>
            {leaveRequests.slice(0, 3).map(lr => (
              <div key={lr.id} className="flex items-center justify-between text-xs py-1.5 border-b border-cortex-border last:border-0">
                <span className="text-cortex-text font-medium">{lr.start_date} – {lr.end_date}</span>
                <div className="flex items-center gap-2">
                  <span className="capitalize text-cortex-muted">{lr.leave_type}</span>
                  <span className={`badge text-[10px] ${
                    lr.status === 'approved' ? 'bg-cortex-success/15 text-cortex-success' :
                    lr.status === 'rejected' ? 'bg-cortex-danger/10 text-cortex-danger' :
                    'bg-cortex-warning/15 text-cortex-warning'
                  }`}>{lr.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {leaveRequests.length === 0 && pendingSwaps.length === 0 && (
          <p className="text-xs text-cortex-muted text-center py-2">No active requests</p>
        )}
      </div>

      {/* Leave request modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-md animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
              <h2 className="font-display font-bold text-cortex-text text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-cortex-accent" /> Request Leave
              </h2>
              <button onClick={() => setShowLeaveModal(false)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitLeave} className="p-6 space-y-4">
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
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Note (optional)</label>
                <textarea value={leaveForm.note}
                  onChange={e => setLeaveForm(f => ({ ...f, note: e.target.value }))}
                  className="input w-full min-h-[70px] resize-y text-sm"
                  placeholder="Additional context for your manager…" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submittingLeave} className="btn-primary flex-1 disabled:opacity-40">
                  {submittingLeave ? 'Submitting…' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setShowLeaveModal(false)} className="btn-secondary px-5">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Swap request modal */}
      {showSwapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-md animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
              <h2 className="font-display font-bold text-cortex-text text-sm flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-cortex-accent" /> Request Shift Swap
              </h2>
              <button onClick={() => setShowSwapModal(false)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitSwap} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">My Shift *</label>
                <select required value={swapMyShiftId}
                  onChange={e => setSwapMyShiftId(e.target.value)}
                  className="input w-full">
                  <option value="">Select one of your upcoming shifts…</option>
                  {shifts.filter(s => s.shift_date >= today).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.shift_date?.slice(0, 10)} · {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Swap with *</label>
                <select required value={swapTargetAgent}
                  onChange={e => setSwapTargetAgent(e.target.value)}
                  className="input w-full">
                  <option value="">Select an agent…</option>
                  {allUsers.filter(u => u.is_active !== false && u.id !== session?.user?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-cortex-muted bg-cortex-bg rounded-xl px-3 py-2">
                The target agent will be notified and must accept before a supervisor reviews.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submittingSwap} className="btn-primary flex-1 disabled:opacity-40">
                  {submittingSwap ? 'Sending…' : 'Send Swap Request'}
                </button>
                <button type="button" onClick={() => setShowSwapModal(false)} className="btn-secondary px-5">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Acknowledgment */}
      {todayShift && (
        <div className={cn(
          'card border-2 transition-colors',
          ackData?.acked ? 'border-cortex-success/30 bg-cortex-success/5' : 'border-cortex-accent/20'
        )}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className={cn('w-5 h-5 flex-shrink-0', ackData?.acked ? 'text-cortex-success' : 'text-cortex-muted')} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-cortex-text text-sm">Shift Briefing</p>
                  <NewBadge description="New — confirm you've read today's briefing. Your acknowledgment is recorded and visible to admins on the Rota page as a green dot next to your name." />
                </div>
                {ackData?.acked ? (
                  <p className="text-xs text-cortex-success mt-0.5">
                    Acknowledged at {new Date(ackData.acked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ) : (
                  <p className="text-xs text-cortex-muted mt-0.5">Confirm you have read today's briefing</p>
                )}
              </div>
            </div>
            <button
              onClick={handleAcknowledge}
              disabled={ackData?.acked || acking}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0',
                ackData?.acked
                  ? 'bg-cortex-success/10 text-cortex-success border border-cortex-success/30 cursor-default'
                  : 'bg-cortex-accent text-white hover:bg-cortex-accent/90 disabled:opacity-50'
              )}
            >
              {acking ? 'Acknowledging…' : ackData?.acked ? '✓ Acknowledged' : 'Acknowledge Shift'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
