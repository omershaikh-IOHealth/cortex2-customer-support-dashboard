'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { BookOpen, Info, Calendar, Clock, Coffee, ChevronLeft, ChevronRight, Zap, CheckCircle, FileText, ArrowLeftRight, X, ChevronDown, ChevronUp } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'
import { useState, useMemo, useEffect, useRef } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { getCirculars, getLeaveRequests, createLeaveRequest, getShiftSwaps, createShiftSwap, respondToSwap, getUsers, getCircularAcks, acknowledgeCirculars } from '@/lib/api'
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

function fmtElapsed(s) {
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export default function BriefingPage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const [weekBase, setWeekBase] = useState(new Date())
  const [shiftViewDate, setShiftViewDate] = useState(new Date()) // Item 16: shift day navigation
  const [acking, setAcking] = useState(false)
  // Session timer — persists across page navigations (sessionStorage) and accumulates
  // across same-day logins (localStorage). Saved before signOut in AgentSidebar/IdleLogout.
  const [sessionElapsed, setSessionElapsed] = useState(0)
  const sessionAccRef = useRef(0)
  const sessionStartMsRef = useRef(0)
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const accKey = `cortex_acc_${todayStr}`
    const startKey = 'cortex_session_start'
    const acc = parseInt(localStorage.getItem(accKey) || '0', 10)
    sessionAccRef.current = acc
    let sessionStart = sessionStorage.getItem(startKey)
    if (!sessionStart) {
      sessionStart = new Date().toISOString()
      sessionStorage.setItem(startKey, sessionStart)
    }
    sessionStartMsRef.current = new Date(sessionStart).getTime()
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartMsRef.current) / 1000)
      setSessionElapsed(sessionAccRef.current + elapsed)
    }, 1000)
    return () => clearInterval(id)
  }, [])
  const [selectedCircular, setSelectedCircular] = useState(null) // for modal
  const [circularsExpanded, setCircularsExpanded] = useState(true) // expandable section

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

  const viewDateStr = fmt(shiftViewDate)
  const viewedShift = shiftsByDate[viewDateStr] ?? null
  function navigateShiftView(dir) {
    const d = new Date(shiftViewDate)
    d.setDate(d.getDate() + dir)
    const newKey = fmt(d)
    if (newKey < fmt(weekDates[0]) || newKey > fmt(weekDates[6])) setWeekBase(d)
    setShiftViewDate(d)
  }
  const firstName = session?.user?.name?.split(' ')[0] || 'Agent'
  // Login time for display in Today's shift (persisted in sessionStorage)
  const loginTimeDisplay = (() => {
    if (typeof window === 'undefined') return null
    const start = sessionStorage.getItem('cortex_session_start')
    if (!start) return null
    return new Date(start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  })()

  const { data: ackData } = useQuery({
    queryKey: ['briefing-ack', todayShift?.id],
    queryFn: () => fetch(`/api/briefing/acknowledge?shift_id=${todayShift.id}`).then(r => r.ok ? r.json() : { acked: false }),
    enabled: !!todayShift?.id,
  })

  // Status history for live timeline — follows the shift date being viewed
  const isViewingToday = viewDateStr === today
  const { data: statusHistory = [] } = useQuery({
    queryKey: ['my-status-history', viewDateStr],
    queryFn: () => fetch(`/api/users/me/status-history?date=${viewDateStr}`).then(r => r.ok ? r.json() : []),
    refetchInterval: isViewingToday ? 30000 : false,
  })
  const [liveElapsed, setLiveElapsed] = useState(0)
  const liveTimerRef = useRef(null)
  const currentStatusEntry = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1] : null
  useEffect(() => {
    if (!currentStatusEntry?.started_at || currentStatusEntry?.ended_at) {
      setLiveElapsed(currentStatusEntry?.duration_secs || 0)
      return
    }
    function tick() {
      setLiveElapsed(Math.floor((Date.now() - new Date(currentStatusEntry.started_at)) / 1000))
    }
    tick()
    liveTimerRef.current = setInterval(tick, 1000)
    return () => clearInterval(liveTimerRef.current)
  }, [currentStatusEntry?.started_at, currentStatusEntry?.ended_at])

  const { data: circularAcks } = useQuery({
    queryKey: ['circular-acks'],
    queryFn: getCircularAcks,
    refetchInterval: 300000,
  })
  const ackedCircularIds = new Set(Object.keys(circularAcks || {}).map(Number))

  async function handleAckCircular(circularId) {
    try {
      await acknowledgeCirculars([circularId])
      qc.invalidateQueries({ queryKey: ['circular-acks'] })
      toast.success('Circular acknowledged')
    } catch {
      toast.error('Failed to acknowledge')
    }
  }

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
            <p className="text-xs text-cortex-muted mt-1">
              Session: <span className="font-mono text-cortex-accent">{fmtElapsed(sessionElapsed)}</span>
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
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cortex-accent" />
              <h2 className="font-semibold text-cortex-text text-sm">
                {viewDateStr === today ? "Today's Shift" : shiftViewDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => navigateShiftView(-1)} className="btn-secondary p-1">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {viewDateStr !== today && (
                <button
                  onClick={() => { setShiftViewDate(new Date()); setWeekBase(new Date()) }}
                  className="text-xs text-cortex-accent hover:underline px-1.5"
                >
                  Today
                </button>
              )}
              <button onClick={() => navigateShiftView(1)} className="btn-secondary p-1">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {viewedShift ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shift info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge bg-cortex-accent/10 text-cortex-accent font-mono">
                    {viewedShift.start_time?.slice(0, 5)} – {viewedShift.end_time?.slice(0, 5)}
                  </span>
                  {viewedShift.shift_type !== 'regular' && (
                    <span className="badge bg-cortex-warning/10 text-cortex-warning capitalize">{viewedShift.shift_type}</span>
                  )}
                  {viewedShift.agent_type && (
                    <span className="badge bg-cortex-surface-raised text-cortex-text capitalize">{viewedShift.agent_type}</span>
                  )}
                </div>
                {viewedShift.breaks?.length > 0 && (
                  <div className="space-y-1">
                    {viewedShift.breaks.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-cortex-muted">
                        <Coffee className="w-3 h-3 text-cortex-warning flex-shrink-0" />
                        <span className="font-mono">{b.break_start?.slice(0, 5)} – {b.break_end?.slice(0, 5)}</span>
                        <span className="text-cortex-border">·</span>
                        <span className="capitalize">{b.break_type || 'break'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {viewDateStr === today && loginTimeDisplay && (
                  <div className="flex items-center gap-2 text-xs pt-1 border-t border-cortex-border mt-1">
                    <span className="text-cortex-muted">Login</span>
                    <span className="font-mono text-cortex-success">{loginTimeDisplay}</span>
                    <span className="text-cortex-muted ml-2">Logout</span>
                    <span className="font-mono text-cortex-muted">—</span>
                  </div>
                )}
                {viewedShift.notes && (
                  <p className="text-xs text-cortex-muted border-t border-cortex-border pt-2">{viewedShift.notes}</p>
                )}
              </div>
              {/* Status totals + live timeline side by side */}
              <div className="border-l border-cortex-border pl-4 flex gap-4">

                {/* Totals per status */}
                {statusHistory.length > 0 && (() => {
                  const totals = {}
                  statusHistory.forEach((entry, i) => {
                    const isLast = i === statusHistory.length - 1
                    const secs = isLast && !entry.ended_at ? liveElapsed : (entry.duration_secs || 0)
                    totals[entry.status] = (totals[entry.status] || 0) + secs
                  })
                  const statusStyle = {
                    available: 'bg-cortex-success/10 text-cortex-success',
                    break:     'bg-blue-400/10 text-blue-400',
                    meeting:   'bg-purple-400/10 text-purple-400',
                    not_ready: 'bg-cortex-danger/10 text-cortex-danger',
                    wrap_up:   'bg-orange-400/10 text-orange-400',
                    busy:      'bg-cortex-warning/10 text-cortex-warning',
                  }
                  return (
                    <div className="min-w-[110px]">
                      <p className="text-[10px] text-cortex-muted uppercase tracking-wider font-semibold mb-2">Time per Status</p>
                      <div className="space-y-1">
                        {Object.entries(totals).map(([st, secs]) => {
                          const h = Math.floor(secs / 3600)
                          const m = Math.floor((secs % 3600) / 60)
                          const s = (secs % 60).toString().padStart(2, '0')
                          const display = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`
                          return (
                            <div key={st} className="flex items-center justify-between gap-2 text-xs">
                              <span className={`badge text-[10px] capitalize ${statusStyle[st] || 'bg-cortex-surface-raised text-cortex-muted'}`}>
                                {st.replace('_', ' ')}
                              </span>
                              <span className="font-mono text-cortex-muted tabular-nums">{display}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Live timeline */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-cortex-muted uppercase tracking-wider font-semibold mb-2">Status Timeline</p>
                  {statusHistory.length === 0 ? (
                    <p className="text-xs text-cortex-muted">{isViewingToday ? 'No status changes logged yet' : 'No status history for this day'}</p>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {statusHistory.map((entry, i) => {
                        const isLast = i === statusHistory.length - 1
                        const secs = isLast && !entry.ended_at ? liveElapsed : entry.duration_secs
                        const m = Math.floor(secs / 60)
                        const s = (secs % 60).toString().padStart(2, '0')
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-cortex-muted w-10 flex-shrink-0">
                              {new Date(entry.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                            <span className={`badge text-[10px] capitalize ${
                              entry.status === 'available' ? 'bg-cortex-success/10 text-cortex-success' :
                              entry.status === 'break' ? 'bg-blue-400/10 text-blue-400' :
                              entry.status === 'busy' ? 'bg-cortex-warning/10 text-cortex-warning' :
                              'bg-cortex-surface-raised text-cortex-muted'
                            }`}>{entry.status.replace('_', ' ')}</span>
                            <span className={`font-mono ml-auto ${isLast && !entry.ended_at ? 'text-cortex-accent' : 'text-cortex-muted'}`}>
                              {m}:{s}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-cortex-muted">No shift scheduled for today</p>
          )}
        </div>

      </div>

      {/* Shift Acknowledgment — moved above circulars per #14 */}
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

      {/* Active Circulars — horizontal scrollable bar (Item 14) */}
      {activeCirculars.length > 0 && (
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <BookOpen className="w-3.5 h-3.5 text-cortex-success" />
            <span className="text-xs font-semibold text-cortex-text">Active Circulars</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-cortex-success/10 text-cortex-success font-mono">{activeCirculars.length}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {activeCirculars.map(c => {
              const isAcked = ackedCircularIds.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCircular(c)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all hover:border-cortex-accent/40 max-w-[220px] ${
                    isAcked ? 'border-cortex-success/30 bg-cortex-success/5' : 'border-cortex-border bg-cortex-bg hover:bg-cortex-surface'
                  }`}
                >
                  {isAcked
                    ? <CheckCircle className="w-3.5 h-3.5 text-cortex-success flex-shrink-0" />
                    : <BookOpen className="w-3.5 h-3.5 text-cortex-accent flex-shrink-0" />}
                  <span className="text-xs font-medium text-cortex-text truncate">{c.title}</span>
                  {c.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cortex-accent/10 text-cortex-accent flex-shrink-0">{c.category}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

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
            // Check if this date falls within any approved leave (Item 11)
            const onLeave = leaveRequests.some(lr =>
              lr.status === 'approved' && key >= lr.start_date?.slice(0,10) && key <= lr.end_date?.slice(0,10)
            )
            return (
              <div
                key={key}
                className={cn(
                  'rounded-xl border p-2 min-h-[96px] flex flex-col transition-colors',
                  isToday
                    ? 'border-cortex-accent bg-cortex-accent/5'
                    : onLeave
                    ? 'border-indigo-400/30 bg-indigo-400/5'
                    : 'border-cortex-border hover:border-cortex-border-strong'
                )}
              >
                <div className="text-center mb-2">
                  <p className="text-[10px] text-cortex-muted uppercase tracking-wider">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={cn('text-sm font-bold', isToday ? 'text-cortex-accent' : onLeave ? 'text-indigo-400' : 'text-cortex-text')}>
                    {date.getDate()}
                  </p>
                </div>
                {onLeave ? (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">On Leave</span>
                  </div>
                ) : shift ? (
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

      {/* Circulars & Knowledge Updates — expandable (Item 20) */}
      <div className="card p-0 overflow-hidden">
        <button
          onClick={() => setCircularsExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-cortex-surface-raised transition-colors"
        >
          <h2 className="font-semibold text-cortex-text flex items-center gap-2 text-sm">
            <BookOpen className="w-4 h-4 text-cortex-success" />
            Circulars &amp; Knowledge Updates
            {activeCirculars.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-cortex-success/10 text-cortex-success font-mono">{activeCirculars.length}</span>
            )}
          </h2>
          {circularsExpanded ? <ChevronUp className="w-4 h-4 text-cortex-muted" /> : <ChevronDown className="w-4 h-4 text-cortex-muted" />}
        </button>

        {circularsExpanded && (
          <div className="px-5 pb-5 pt-1 border-t border-cortex-border">
            {circLoading ? (
              <div className="animate-pulse h-24 bg-cortex-bg rounded-xl mt-3" />
            ) : activeCirculars.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-8 h-8 text-cortex-muted mx-auto mb-2 opacity-40" />
                <p className="text-sm text-cortex-muted">No circulars published yet</p>
              </div>
            ) : (
              <div className="space-y-2 mt-3 max-h-96 overflow-y-auto pr-1">
                {activeCirculars.map(c => {
                  const isAcked = ackedCircularIds.has(c.id)
                  return (
                    <div key={c.id} className={`rounded-xl border p-3 transition-colors cursor-pointer ${isAcked ? 'border-cortex-success/20 bg-cortex-success/3' : 'border-cortex-border hover:border-cortex-accent/30'}`}
                      onClick={() => setSelectedCircular(c)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-cortex-text mb-0.5 truncate text-sm">{c.title}</p>
                          <p className="text-xs text-cortex-muted line-clamp-1">{c.content}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {c.category && <span className="badge text-xs bg-cortex-accent/10 text-cortex-accent">{c.category}</span>}
                            {c.tags?.map(tag => <span key={tag} className="badge text-xs bg-cortex-surface-raised text-cortex-muted">#{tag}</span>)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-[10px] text-cortex-muted font-mono">{formatRelativeTime(c.updated_at || c.created_at)}</span>
                          {isAcked
                            ? <CheckCircle className="w-4 h-4 text-cortex-success" />
                            : <span className="text-[10px] text-cortex-accent">Click to read →</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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

      {/* Circular detail modal (Item 14) */}
      {selectedCircular && (() => {
        const c = selectedCircular
        const isAcked = ackedCircularIds.has(c.id)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-lg animate-slide-in flex flex-col max-h-[85vh]">
              <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-cortex-border flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {c.category && <span className="badge text-xs bg-cortex-accent/10 text-cortex-accent">{c.category}</span>}
                    {c.tags?.map(t => <span key={t} className="badge text-xs bg-cortex-surface-raised text-cortex-muted">#{t}</span>)}
                  </div>
                  <h2 className="font-display font-bold text-cortex-text">{c.title}</h2>
                  <p className="text-xs text-cortex-muted mt-0.5">{formatRelativeTime(c.updated_at || c.created_at)}</p>
                </div>
                <button onClick={() => setSelectedCircular(null)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <p className="text-sm text-cortex-text leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
              <div className="px-6 py-4 border-t border-cortex-border flex-shrink-0 flex items-center justify-between gap-3">
                <button
                  onClick={async () => { await handleAckCircular(c.id); setSelectedCircular(null) }}
                  disabled={isAcked}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isAcked
                      ? 'bg-cortex-success/10 text-cortex-success border border-cortex-success/30 cursor-default'
                      : 'bg-cortex-accent text-white hover:bg-cortex-accent/90'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {isAcked ? '✓ Acknowledged' : 'Acknowledge & Close'}
                </button>
                <button onClick={() => setSelectedCircular(null)} className="btn-secondary text-sm">Close</button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
