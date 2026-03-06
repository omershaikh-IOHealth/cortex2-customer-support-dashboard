'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, CalendarRange, Plus, Trash2, ChevronLeft, ChevronRight, Clock, Coffee, CheckCircle, Circle, FileText, ArrowLeftRight, Umbrella } from 'lucide-react'
import Modal from './Modal'
import { getUsers, getRotas, createRota, updateRota, deleteRota, createBulkRota, getLeaveRequests, reviewLeaveRequest, getShiftSwaps, reviewShiftSwap } from '@/lib/api'
import toast from 'react-hot-toast'
import NewBadge from './NewBadge'

function getWeekDates(base) {
  const d = new Date(base)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

function fmt(date) {
  // Use local date parts — toISOString() would shift to UTC and produce wrong date
  // in timezones ahead of UTC (e.g. UAE UTC+4 midnight = previous day in UTC)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}


export default function RotaManagementSection() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('rota')
  const [weekBase, setWeekBase] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false)
  const [prefillDate, setPrefillDate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const [dragOverCell, setDragOverCell] = useState(null) // `${agentId}-${date}`
  const dragShiftRef = useRef(null) // { id, shift_date }
  const [prefillUserId, setPrefillUserId] = useState(null)

  // Leave tab filters
  const [leaveAgentFilter, setLeaveAgentFilter] = useState('')
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('')

  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase])
  const from = fmt(weekDates[0])
  const to   = fmt(weekDates[6])

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['admin-rota', from, to],
    queryFn: () => getRotas({ from, to }),
    refetchInterval: 60000,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agent-list'],
    queryFn: () => getUsers().then(users => users.filter(u => u.role === 'agent' && u.is_active)),
    staleTime: 300000,
  })

  const { data: allLeave = [] } = useQuery({
    queryKey: ['admin-leave-requests'],
    queryFn: () => getLeaveRequests(true),
    refetchInterval: 60000,
  })

  const { data: allSwaps = [] } = useQuery({
    queryKey: ['admin-shift-swaps'],
    queryFn: () => getShiftSwaps(true),
    enabled: activeTab === 'swaps',
    refetchInterval: 60000,
  })

  async function handleLeaveReview(id, status) {
    try {
      await reviewLeaveRequest(id, { status })
      toast.success(`Leave ${status}`)
      qc.invalidateQueries({ queryKey: ['admin-leave-requests'] })
    } catch (e) {
      toast.error(e.message || 'Failed')
    }
  }

  async function handleSwapReview(id, decision) {
    try {
      await reviewShiftSwap(id, { decision })
      toast.success(`Swap ${decision}`)
      qc.invalidateQueries({ queryKey: ['admin-shift-swaps'] })
    } catch (e) {
      toast.error(e.message || 'Failed')
    }
  }

  const pendingLeave = allLeave.filter(l => l.status === 'pending').length
  const pendingSwapsCount = allSwaps.filter(s => s.status === 'awaiting_supervisor').length

  function showToast(msg, type = 'success') {
    setToastMsg({ msg, type })
    setTimeout(() => setToastMsg(null), 3500)
  }

  async function handleSave(form) {
    setSaving(true)
    try {
      await createRota(form)
      await qc.invalidateQueries({ queryKey: ['admin-rota'] })
      showToast('Shift created')
      setModalOpen(false)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkSave(form) {
    setSaving(true)
    try {
      const result = await createBulkRota(form)
      await qc.invalidateQueries({ queryKey: ['admin-rota'] })
      const skipped = form.dates.length - result.created
      const msg = skipped > 0
        ? `${result.created} shifts assigned, ${skipped} skipped (already exist)`
        : `${result.created} shift${result.created !== 1 ? 's' : ''} assigned`
      showToast(msg)
      setWeeklyModalOpen(false)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this shift?')) return
    try {
      await deleteRota(id)
      await qc.invalidateQueries({ queryKey: ['admin-rota'] })
      showToast('Shift removed')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleMoveShift(shiftId, newDate) {
    if (!shiftId || !newDate) return
    try {
      await updateRota(shiftId, { shift_date: newDate })
      await qc.invalidateQueries({ queryKey: ['admin-rota'] })
      showToast('Shift moved')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  function prevWeek() {
    const d = new Date(weekBase)
    d.setDate(d.getDate() - 7)
    setWeekBase(d)
  }
  function nextWeek() {
    const d = new Date(weekBase)
    d.setDate(d.getDate() + 7)
    setWeekBase(d)
  }

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const map = {}
    for (const s of shifts) {
      const key = typeof s.shift_date === 'string' ? s.shift_date.slice(0, 10) : fmt(new Date(s.shift_date))
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return map
  }, [shifts])

  // Approved leaves for overlay on the rota grid
  const approvedLeaves = useMemo(() => allLeave.filter(l => l.status === 'approved'), [allLeave])

  const today = fmt(new Date())

  // Fetch briefing ack status for today's shifts
  const { data: todayAcks = [] } = useQuery({
    queryKey: ['briefing-acks-today', today],
    queryFn: () => fetch(`/api/admin/briefing-acks?date=${today}`).then(r => r.ok ? r.json() : []),
    refetchInterval: 60000,
  })
  const ackByUserId = useMemo(() => {
    const map = {}
    for (const a of todayAcks) map[a.user_id] = a.acked_at
    return map
  }, [todayAcks])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cortex-warning/10 rounded-lg">
            <Calendar className="w-5 h-5 text-cortex-warning" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-cortex-text">ROTA Management</h2>
            <p className="text-xs text-cortex-muted">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' — '}
              {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · drag shifts to move'}
            </p>
          </div>
        </div>
        {activeTab === 'rota' && (
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setWeekBase(new Date())} className="btn-secondary text-sm px-3 py-2">Today</button>
            <button onClick={nextWeek} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
            <button
              onClick={() => setWeeklyModalOpen(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <CalendarRange className="w-4 h-4" /> Weekly Schedule
            </button>
            <button
              onClick={() => { setPrefillDate(today); setModalOpen(true) }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Shift
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-cortex-surface rounded-xl border border-cortex-border w-fit">
        <button
          onClick={() => setActiveTab('rota')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'rota' ? 'bg-cortex-bg text-cortex-text shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}
        >
          <Calendar className="w-3.5 h-3.5" /> Rota
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'leave' ? 'bg-cortex-bg text-cortex-text shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}
        >
          <FileText className="w-3.5 h-3.5" /> Leave Requests
          <NewBadge description="New tab — review all agent leave requests. Approve or reject with one click." />
          {pendingLeave > 0 && <span className="text-[9px] bg-cortex-warning/20 text-cortex-warning px-1.5 py-0.5 rounded font-mono">{pendingLeave}</span>}
        </button>
        <button
          onClick={() => setActiveTab('swaps')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'swaps' ? 'bg-cortex-bg text-cortex-text shadow-sm' : 'text-cortex-muted hover:text-cortex-text'}`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> Shift Swaps
          <NewBadge description="New tab — shift swap requests needing supervisor approval appear here." />
          {pendingSwapsCount > 0 && <span className="text-[9px] bg-cortex-warning/20 text-cortex-warning px-1.5 py-0.5 rounded font-mono">{pendingSwapsCount}</span>}
        </button>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toastMsg.type === 'error' ? 'bg-cortex-danger text-white' : 'bg-cortex-success text-white'
        }`}>
          {toastMsg.msg}
        </div>
      )}

      {/* Leave Requests tab */}
      {activeTab === 'leave' && (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={leaveAgentFilter}
              onChange={e => setLeaveAgentFilter(e.target.value)}
              className="input text-xs py-1.5 px-2 h-auto"
            >
              <option value="">All Agents</option>
              {agents.map(a => <option key={a.id} value={String(a.id)}>{a.full_name}</option>)}
            </select>
            <select
              value={leaveStatusFilter}
              onChange={e => setLeaveStatusFilter(e.target.value)}
              className="input text-xs py-1.5 px-2 h-auto"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            {(leaveAgentFilter || leaveStatusFilter) && (
              <button onClick={() => { setLeaveAgentFilter(''); setLeaveStatusFilter('') }} className="text-xs text-cortex-muted hover:text-cortex-text">✕ Clear</button>
            )}
          </div>
          {(() => {
            const filtered = allLeave.filter(lr =>
              (!leaveAgentFilter || String(lr.user_id) === leaveAgentFilter) &&
              (!leaveStatusFilter || lr.status === leaveStatusFilter)
            )
            return filtered.length === 0 ? (
              <p className="text-sm text-cortex-muted text-center py-10">No leave requests match the filter</p>
            ) : (
            <div className="overflow-x-auto rounded-xl border border-cortex-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cortex-border bg-cortex-bg">
                    <th className="table-header">Agent</th>
                    <th className="table-header">Dates</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Note</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cortex-border">
                  {filtered.map(lr => (
                    <tr key={lr.id} className="hover:bg-cortex-surface-raised">
                      <td className="table-cell">
                        <p className="text-xs font-medium text-cortex-text">{lr.user_name}</p>
                        <p className="text-[10px] text-cortex-muted">{lr.user_email?.split('@')[0]}</p>
                      </td>
                      <td className="table-cell text-xs">
                        {new Date(lr.start_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' – '}
                        {new Date(lr.end_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="table-cell"><span className="badge bg-cortex-accent/10 text-cortex-accent capitalize">{lr.leave_type}</span></td>
                      <td className="table-cell text-xs text-cortex-muted max-w-xs"><p className="line-clamp-2">{lr.note || '—'}</p></td>
                      <td className="table-cell">
                        <span className={`badge text-[10px] ${lr.status === 'approved' ? 'bg-cortex-success/15 text-cortex-success' : lr.status === 'rejected' ? 'bg-cortex-danger/10 text-cortex-danger' : 'bg-cortex-warning/15 text-cortex-warning'}`}>
                          {lr.status}
                        </span>
                      </td>
                      <td className="table-cell">
                        {lr.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleLeaveReview(lr.id, 'approved')} className="text-xs bg-cortex-success/15 text-cortex-success hover:bg-cortex-success/25 px-2.5 py-1 rounded-lg transition-colors font-medium">Approve</button>
                            <button onClick={() => handleLeaveReview(lr.id, 'rejected')} className="text-xs bg-cortex-danger/10 text-cortex-danger hover:bg-cortex-danger/20 px-2.5 py-1 rounded-lg transition-colors font-medium">Reject</button>
                          </div>
                        )}
                        {lr.status !== 'pending' && <span className="text-xs text-cortex-muted">by {lr.reviewer_name || '—'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          })()}
        </div>
      )}

      {/* Shift Swaps tab */}
      {activeTab === 'swaps' && (
        <div className="space-y-3">
          {allSwaps.length === 0 ? (
            <p className="text-sm text-cortex-muted text-center py-10">No shift swap requests yet</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-cortex-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cortex-border bg-cortex-bg">
                    <th className="table-header">Requester</th>
                    <th className="table-header">Their Shift</th>
                    <th className="table-header">Target Agent</th>
                    <th className="table-header">Target Shift</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cortex-border">
                  {allSwaps.map(s => (
                    <tr key={s.id} className="hover:bg-cortex-surface-raised">
                      <td className="table-cell">
                        <p className="text-xs font-medium text-cortex-text">{s.requester_name}</p>
                      </td>
                      <td className="table-cell text-xs font-mono">{s.requester_shift_date?.slice(0, 10)} {s.requester_start?.slice(0, 5)}–{s.requester_end?.slice(0, 5)}</td>
                      <td className="table-cell text-xs text-cortex-text">{s.target_agent_name}</td>
                      <td className="table-cell text-xs font-mono">{s.target_shift_date ? `${s.target_shift_date.slice(0, 10)} ${s.target_start?.slice(0, 5)}–${s.target_end?.slice(0, 5)}` : '—'}</td>
                      <td className="table-cell">
                        <span className={`badge text-[10px] ${
                          s.status === 'approved' ? 'bg-cortex-success/15 text-cortex-success' :
                          s.status === 'rejected' ? 'bg-cortex-danger/10 text-cortex-danger' :
                          s.status === 'awaiting_supervisor' ? 'bg-cortex-accent/10 text-cortex-accent' :
                          'bg-cortex-warning/15 text-cortex-warning'
                        }`}>{s.status?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="table-cell">
                        {s.status === 'awaiting_supervisor' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleSwapReview(s.id, 'approved')} className="text-xs bg-cortex-success/15 text-cortex-success hover:bg-cortex-success/25 px-2.5 py-1 rounded-lg transition-colors font-medium">Approve</button>
                            <button onClick={() => handleSwapReview(s.id, 'rejected')} className="text-xs bg-cortex-danger/10 text-cortex-danger hover:bg-cortex-danger/20 px-2.5 py-1 rounded-lg transition-colors font-medium">Reject</button>
                          </div>
                        )}
                        {s.status !== 'awaiting_supervisor' && (
                          <span className="text-xs text-cortex-muted capitalize">{s.target_response}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Agent-row rota grid */}
      {activeTab === 'rota' && (
        <div className="overflow-x-auto rounded-xl border border-cortex-border">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-14 bg-cortex-surface animate-pulse rounded-lg" />)}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-cortex-surface border-b border-cortex-border">
                  <th className="w-40 min-w-[10rem] px-3 py-2.5 text-left text-xs font-medium text-cortex-muted uppercase tracking-wider border-r border-cortex-border sticky left-0 bg-cortex-surface z-10">
                    Agent
                  </th>
                  {weekDates.map(date => {
                    const key = fmt(date)
                    const isToday = key === today
                    return (
                      <th key={key} className={`px-2 py-2 text-center border-r border-cortex-border last:border-r-0 min-w-[110px] ${isToday ? 'bg-cortex-accent/8' : ''}`}>
                        <p className="text-[10px] text-cortex-muted uppercase tracking-wide">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        <p className={`text-sm font-bold ${isToday ? 'text-cortex-accent' : 'text-cortex-text'}`}>{date.getDate()}</p>
                        <p className="text-[10px] text-cortex-muted">{date.toLocaleDateString('en-US', { month: 'short' })}</p>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-cortex-border">
                {agents.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-cortex-muted text-sm">No active agents found</td></tr>
                ) : agents.map(agent => (
                  <tr key={agent.id} className="hover:bg-cortex-bg/40 transition-colors">
                    {/* Agent label — sticky */}
                    <td className="px-3 py-2.5 border-r border-cortex-border sticky left-0 bg-cortex-surface z-10 align-top">
                      <p className="text-xs font-semibold text-cortex-text leading-tight">{agent.full_name}</p>
                      <p className="text-[10px] text-cortex-muted font-mono">{agent.email?.split('@')[0]}</p>
                    </td>
                    {/* One cell per day */}
                    {weekDates.map(date => {
                      const key = fmt(date)
                      const isToday = key === today
                      const isPast  = key < today
                      const cellKey = `${agent.id}-${key}`
                      const dayShifts = (shiftsByDate[key] || []).filter(s => String(s.user_id) === String(agent.id))
                      const onLeave = approvedLeaves.some(lr =>
                        String(lr.user_id) === String(agent.id) &&
                        key >= lr.start_date?.slice(0, 10) &&
                        key <= lr.end_date?.slice(0, 10)
                      )
                      return (
                        <td
                          key={key}
                          className={`px-1.5 py-1.5 border-r border-cortex-border last:border-r-0 align-top transition-colors
                            ${isToday ? 'bg-cortex-accent/4' : ''}
                            ${dragOverCell === cellKey ? 'bg-cortex-accent/10 outline outline-1 outline-cortex-accent' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDragOverCell(cellKey) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCell(null) }}
                          onDrop={e => {
                            e.preventDefault()
                            setDragOverCell(null)
                            const shift = dragShiftRef.current
                            if (shift && shift.shift_date !== key) handleMoveShift(shift.id, key)
                            dragShiftRef.current = null
                          }}
                        >
                          {onLeave ? (
                            <div className="rounded px-1.5 py-2 bg-indigo-400/10 border border-indigo-400/30 text-center">
                              <Umbrella className="w-3 h-3 mx-auto text-indigo-400 mb-0.5" />
                              <p className="text-[9px] text-indigo-400 font-medium">On Leave</p>
                            </div>
                          ) : dayShifts.length === 0 ? (
                            !isPast ? (
                              <button
                                onClick={() => { setPrefillDate(key); setPrefillUserId(String(agent.id)); setModalOpen(true) }}
                                className="w-full h-full min-h-[40px] text-[10px] text-cortex-muted hover:text-cortex-accent hover:bg-cortex-accent/5 rounded transition-colors flex items-center justify-center"
                              >
                                + Add
                              </button>
                            ) : (
                              <p className="text-[10px] text-cortex-muted text-center py-2">—</p>
                            )
                          ) : (
                            <div className="space-y-1">
                              {dayShifts.map(s => {
                                const ackedAt = isToday ? ackByUserId[s.user_id] : null
                                const shiftTypeStyle =
                                  s.shift_type === 'overtime' ? 'bg-cortex-warning/8 border-cortex-warning/40' :
                                  s.shift_type === 'on_call'  ? 'bg-purple-400/8 border-purple-400/40' :
                                  'bg-cortex-bg border-cortex-border'
                                return (
                                  <div
                                    key={s.id}
                                    draggable
                                    onDragStart={e => {
                                      dragShiftRef.current = { id: s.id, shift_date: key }
                                      e.dataTransfer.effectAllowed = 'move'
                                    }}
                                    onDragEnd={() => setDragOverCell(null)}
                                    className={`${shiftTypeStyle} border rounded p-1.5 group relative cursor-grab active:cursor-grabbing`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5 text-cortex-muted flex-shrink-0" />
                                      <span className="text-[10px] font-mono text-cortex-text">{s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</span>
                                      {isToday && (
                                        <span className="ml-auto flex-shrink-0" title={ackedAt ? `Acked ${new Date(ackedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}` : 'Not acknowledged'}>
                                          {ackedAt
                                            ? <CheckCircle className="w-3 h-3 text-cortex-success" />
                                            : <Circle className="w-3 h-3 text-cortex-muted" />}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                      {s.agent_type && <span className="text-[9px] px-1 py-0.5 rounded bg-cortex-accent/10 text-cortex-accent capitalize">{s.agent_type}</span>}
                                      {s.shift_type !== 'regular' && (
                                        <span className={`text-[9px] px-1 py-0.5 rounded capitalize ${s.shift_type === 'overtime' ? 'bg-cortex-warning/15 text-cortex-warning' : 'bg-purple-400/15 text-purple-400'}`}>
                                          {s.shift_type}
                                        </span>
                                      )}
                                      {s.breaks?.length > 0 && (
                                        <span className="text-[9px] text-cortex-warning flex items-center gap-0.5">
                                          <Coffee className="w-2.5 h-2.5" />{s.breaks.length}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleDelete(s.id)}
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-cortex-muted hover:text-cortex-danger transition-all"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )
                              })}
                              {!isPast && (
                                <button
                                  onClick={() => { setPrefillDate(key); setPrefillUserId(String(agent.id)); setModalOpen(true) }}
                                  className="w-full text-[10px] text-cortex-muted hover:text-cortex-accent py-0.5 rounded hover:bg-cortex-accent/5 transition-colors"
                                >
                                  + More
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ShiftModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setPrefillUserId(null) }}
        onSave={handleSave}
        saving={saving}
        agents={agents}
        prefillDate={prefillDate}
        prefillUserId={prefillUserId}
        existingShifts={shifts}
      />

      <WeeklyScheduleModal
        isOpen={weeklyModalOpen}
        onClose={() => setWeeklyModalOpen(false)}
        onSave={handleBulkSave}
        saving={saving}
        agents={agents}
        initialWeekBase={weekBase}
      />
    </div>
  )
}

// ─── Single shift modal ────────────────────────────────────────────────────────
function ShiftModal({ isOpen, onClose, onSave, saving, agents, prefillDate, prefillUserId, existingShifts = [] }) {
  const [form, setForm] = useState({
    user_id: prefillUserId || '',
    shift_date: prefillDate || '',
    start_time: '09:00',
    end_time: '18:00',
    shift_type: 'regular',
    agent_type: '',
    notes: '',
    breaks: [],
  })
  const [conflictWarning, setConflictWarning] = useState(null)

  // Sync prefill date
  if (prefillDate && form.shift_date !== prefillDate && !form._synced) {
    setForm(f => ({ ...f, shift_date: prefillDate, _synced: true }))
  }
  // Sync prefill user
  if (prefillUserId && form.user_id !== String(prefillUserId) && !form._userSynced) {
    setForm(f => ({ ...f, user_id: String(prefillUserId), _userSynced: true }))
  }

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    // Reset conflict warning when agent or date changes
    if (k === 'user_id' || k === 'shift_date') setConflictWarning(null)
  }

  function checkAndSubmit(e) {
    e.preventDefault()
    // Check for existing shift for same agent on same date
    if (form.user_id && form.shift_date) {
      const conflict = existingShifts.find(s =>
        String(s.user_id) === String(form.user_id) &&
        (typeof s.shift_date === 'string' ? s.shift_date.slice(0, 10) : s.shift_date) === form.shift_date
      )
      if (conflict && !conflictWarning) {
        setConflictWarning({
          existing: `${conflict.start_time?.slice(0,5)}–${conflict.end_time?.slice(0,5)} (${conflict.shift_type})`
        })
        return
      }
    }
    setConflictWarning(null)
    onSave({ ...form })
  }

  function addBreak() {
    setForm(f => ({
      ...f,
      breaks: [...f.breaks, { break_start: '13:00', break_end: '13:30', break_type: 'lunch' }],
    }))
  }

  function updateBreak(i, k, v) {
    setForm(f => {
      const breaks = [...f.breaks]
      breaks[i] = { ...breaks[i], [k]: v }
      return { ...f, breaks }
    })
  }

  function removeBreak(i) {
    setForm(f => ({ ...f, breaks: f.breaks.filter((_, j) => j !== i) }))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Shift">
      <form onSubmit={checkAndSubmit} className="space-y-4">

        {/* Conflict warning */}
        {conflictWarning && (
          <div className="p-3 bg-cortex-warning/10 border border-cortex-warning/30 rounded-lg text-xs text-cortex-warning">
            <p className="font-semibold mb-1">⚠ Shift conflict detected</p>
            <p>This agent already has a shift: <span className="font-mono">{conflictWarning.existing}</span></p>
            <p className="mt-1.5 text-cortex-text">Save anyway and add as <strong>{form.shift_type}</strong>?</p>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="text-xs bg-cortex-warning/20 text-cortex-warning hover:bg-cortex-warning/30 px-3 py-1.5 rounded-lg font-medium">
                Yes, Save Anyway
              </button>
              <button type="button" onClick={() => setConflictWarning(null)} className="text-xs text-cortex-muted hover:text-cortex-text px-3 py-1.5 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Agent *</label>
            <select value={form.user_id} onChange={e => set('user_id', e.target.value)} className="input w-full" required>
              <option value="">Select agent…</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Date *</label>
            <input type="date" value={form.shift_date} onChange={e => set('shift_date', e.target.value)} className="input w-full" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Start *</label>
            <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">End *</label>
            <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="input w-full" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Shift Type</label>
            <select value={form.shift_type} onChange={e => set('shift_type', e.target.value)} className="input w-full">
              <option value="regular">Regular</option>
              <option value="overtime">Overtime</option>
              <option value="on_call">On Call</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Agent Role</label>
            <select value={form.agent_type} onChange={e => set('agent_type', e.target.value)} className="input w-full">
              <option value="">— Not specified —</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
        </div>

        {/* Breaks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Scheduled Breaks</label>
            <button type="button" onClick={addBreak} className="text-xs text-cortex-accent hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Break
            </button>
          </div>
          {form.breaks.map((b, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2 items-center">
              <input type="time" value={b.break_start} onChange={e => updateBreak(i, 'break_start', e.target.value)} className="input text-sm" />
              <input type="time" value={b.break_end} onChange={e => updateBreak(i, 'break_end', e.target.value)} className="input text-sm" />
              <div className="flex gap-1">
                <select value={b.break_type} onChange={e => updateBreak(i, 'break_type', e.target.value)} className="input text-sm flex-1">
                  <option value="scheduled">Scheduled</option>
                  <option value="lunch">Lunch</option>
                </select>
                <button type="button" onClick={() => removeBreak(i)} className="text-cortex-muted hover:text-cortex-danger">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Notes</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className="input w-full" placeholder="Optional note…" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Shift'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Weekly schedule bulk assignment modal ────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function WeeklyScheduleModal({ isOpen, onClose, onSave, saving, agents, initialWeekBase }) {
  const [weekBase, setWeekBase] = useState(initialWeekBase || new Date())
  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4]) // Mon–Fri by default
  const [form, setForm] = useState({
    user_id: '',
    start_time: '09:00',
    end_time: '18:00',
    shift_type: 'regular',
    agent_type: '',
    notes: '',
    breaks: [],
    replace_existing: false,
  })

  // Reset state each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setWeekBase(initialWeekBase || new Date())
      setSelectedDays([0, 1, 2, 3, 4])
      setForm({
        user_id: '',
        start_time: '09:00',
        end_time: '18:00',
        shift_type: 'regular',
        agent_type: '',
        notes: '',
        breaks: [],
        replace_existing: false,
      })
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleDay(i) {
    setSelectedDays(prev =>
      prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort((a, b) => a - b)
    )
  }

  function addBreak() {
    setForm(f => ({
      ...f,
      breaks: [...f.breaks, { break_start: '13:00', break_end: '13:30', break_type: 'lunch' }],
    }))
  }

  function updateBreak(i, k, v) {
    setForm(f => {
      const breaks = [...f.breaks]
      breaks[i] = { ...breaks[i], [k]: v }
      return { ...f, breaks }
    })
  }

  function removeBreak(i) {
    setForm(f => ({ ...f, breaks: f.breaks.filter((_, j) => j !== i) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (selectedDays.length === 0) return
    const dates = selectedDays.map(i => fmt(weekDates[i]))
    onSave({ ...form, dates })
  }

  const selectedAgent = agents.find(a => String(a.id) === String(form.user_id))

  function prevWeek() {
    const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d)
  }
  function nextWeek() {
    const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Weekly Schedule">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Agent */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Agent *</label>
          <select
            value={form.user_id}
            onChange={e => set('user_id', e.target.value)}
            className="input w-full"
            required
          >
            <option value="">Select agent…</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
        </div>

        {/* Week navigator */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Week</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={prevWeek} className="btn-secondary p-1.5">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-cortex-text flex-1 text-center">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' — '}
              {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button type="button" onClick={nextWeek} className="btn-secondary p-1.5">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Working Days *</label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDays([0, 1, 2, 3, 4])}
                className="text-cortex-accent hover:underline"
              >
                Mon–Fri
              </button>
              <span className="text-cortex-border">|</span>
              <button
                type="button"
                onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                className="text-cortex-accent hover:underline"
              >
                All 7
              </button>
              <span className="text-cortex-border">|</span>
              <button
                type="button"
                onClick={() => setSelectedDays([])}
                className="text-cortex-muted hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((d, i) => {
              const sel = selectedDays.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-lg border text-xs transition-all ${
                    sel
                      ? 'bg-cortex-accent/20 border-cortex-accent text-cortex-accent font-semibold'
                      : 'border-cortex-border text-cortex-muted hover:border-cortex-muted hover:text-cortex-text'
                  }`}
                >
                  <span className="uppercase tracking-wide text-[10px]">{DAY_LABELS[i]}</span>
                  <span className="text-base font-bold mt-0.5">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Hours + type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Start *</label>
            <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">End *</label>
            <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="input w-full" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Shift Type</label>
            <select value={form.shift_type} onChange={e => set('shift_type', e.target.value)} className="input w-full">
              <option value="regular">Regular</option>
              <option value="overtime">Overtime</option>
              <option value="on_call">On Call</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Agent Role</label>
            <select value={form.agent_type} onChange={e => set('agent_type', e.target.value)} className="input w-full">
              <option value="">— Not specified —</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
        </div>

        {/* Breaks — apply to every selected day */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Breaks <span className="text-cortex-muted font-normal">(applied to all days)</span></label>
            <button type="button" onClick={addBreak} className="text-xs text-cortex-accent hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Break
            </button>
          </div>
          {form.breaks.length === 0 && (
            <p className="text-xs text-cortex-muted">No breaks — shifts will have no scheduled breaks.</p>
          )}
          {form.breaks.map((b, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2 items-center">
              <input type="time" value={b.break_start} onChange={e => updateBreak(i, 'break_start', e.target.value)} className="input text-sm" />
              <input type="time" value={b.break_end} onChange={e => updateBreak(i, 'break_end', e.target.value)} className="input text-sm" />
              <div className="flex gap-1">
                <select value={b.break_type} onChange={e => updateBreak(i, 'break_type', e.target.value)} className="input text-sm flex-1">
                  <option value="scheduled">Scheduled</option>
                  <option value="lunch">Lunch</option>
                </select>
                <button type="button" onClick={() => removeBreak(i)} className="text-cortex-muted hover:text-cortex-danger">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Notes</label>
          <input
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="input w-full"
            placeholder="Optional note applied to all shifts…"
          />
        </div>

        {/* Replace existing toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.replace_existing}
            onChange={e => set('replace_existing', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-cortex-muted">
            Replace existing shifts on selected days
            <span className="ml-1 text-cortex-warning text-xs">(will delete and recreate)</span>
          </span>
        </label>

        {/* Live preview */}
        {selectedDays.length > 0 && form.user_id && (
          <div className="p-3 bg-cortex-bg border border-cortex-border rounded-lg text-xs space-y-1">
            <p className="text-cortex-text font-medium">
              Will create {selectedDays.length} shift{selectedDays.length !== 1 ? 's' : ''} for {selectedAgent?.full_name}
            </p>
            <p className="text-cortex-muted">
              {selectedDays.map(i =>
                weekDates[i].toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              ).join(' · ')}
            </p>
            <p className="text-cortex-muted">
              {form.start_time} – {form.end_time} · {form.shift_type}
              {form.breaks.length > 0 && ` · ${form.breaks.length} break${form.breaks.length > 1 ? 's' : ''}`}
            </p>
            {form.replace_existing && (
              <p className="text-cortex-warning">⚠ Existing shifts for this agent on these days will be replaced</p>
            )}
            {!form.replace_existing && (
              <p className="text-cortex-muted opacity-70">Days that already have a shift for this agent will be skipped</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="submit"
            disabled={saving || selectedDays.length === 0 || !form.user_id}
            className="btn-primary disabled:opacity-50"
          >
            {saving
              ? 'Assigning…'
              : `Assign ${selectedDays.length} Shift${selectedDays.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
