'use client'

import { useState, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight, Clock, Coffee } from 'lucide-react'
import Modal from './Modal'
import { getUsers, getRotas, createRota, updateRota, deleteRota } from '@/lib/api'

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
  const [weekBase, setWeekBase] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [prefillDate, setPrefillDate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [dragOverDate, setDragOverDate] = useState(null)
  const dragShiftRef = useRef(null) // { id, shift_date }

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

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
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

  const today = fmt(new Date())

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
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setWeekBase(new Date())} className="btn-secondary text-sm px-3 py-2">Today</button>
          <button onClick={nextWeek} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
          <button
            onClick={() => { setPrefillDate(today); setModalOpen(true) }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Shift
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'error' ? 'bg-cortex-danger text-white' : 'bg-cortex-success text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDates.map(date => {
          const key = fmt(date)
          const dayShifts = shiftsByDate[key] || []
          const isToday = key === today
          const isPast = key < today
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
          const dayNum  = date.getDate()

          return (
            <div
              key={key}
              className={`rounded-lg border min-h-[160px] flex flex-col overflow-hidden transition-colors
                ${isToday ? 'border-cortex-accent' : 'border-cortex-border'}
                ${isPast ? 'opacity-70' : ''}
                ${dragOverDate === key ? 'border-cortex-accent bg-cortex-accent/5' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverDate(key) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDate(null) }}
              onDrop={e => {
                e.preventDefault()
                setDragOverDate(null)
                const shift = dragShiftRef.current
                if (shift && shift.shift_date !== key) handleMoveShift(shift.id, key)
                dragShiftRef.current = null
              }}
            >
              {/* Day header */}
              <div className={`px-2 py-1.5 text-center border-b border-cortex-border
                ${isToday ? 'bg-cortex-accent/10' : 'bg-cortex-surface'}`}>
                <p className="text-xs text-cortex-muted uppercase">{dayName}</p>
                <p className={`text-sm font-bold ${isToday ? 'text-cortex-accent' : 'text-cortex-text'}`}>{dayNum}</p>
              </div>

              {/* Shifts */}
              <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                {isLoading ? (
                  <div className="h-8 bg-cortex-border/30 animate-pulse rounded" />
                ) : dayShifts.length === 0 ? (
                  <p className="text-xs text-cortex-muted text-center pt-4">—</p>
                ) : (
                  dayShifts.map(s => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={e => {
                        dragShiftRef.current = { id: s.id, shift_date: key }
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDragOverDate(null)}
                      className="bg-cortex-bg border border-cortex-border rounded p-1.5 group relative cursor-grab active:cursor-grabbing"
                    >
                      <div className="text-xs font-medium text-cortex-text truncate">{s.agent_name}</div>
                      <div className="flex items-center gap-1 text-xs text-cortex-muted mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
                      </div>
                      {s.breaks?.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-cortex-warning mt-0.5">
                          <Coffee className="w-2.5 h-2.5" />
                          {s.breaks.length} break{s.breaks.length > 1 ? 's' : ''}
                        </div>
                      )}
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-cortex-muted hover:text-cortex-danger transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add shift for this day */}
              {!isPast && (
                <button
                  onClick={() => { setPrefillDate(key); setModalOpen(true) }}
                  className="w-full py-1.5 text-xs text-cortex-muted hover:text-cortex-accent hover:bg-cortex-accent/5 border-t border-cortex-border transition-colors"
                >
                  + Add
                </button>
              )}
            </div>
          )
        })}
      </div>

      <ShiftModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        saving={saving}
        agents={agents}
        prefillDate={prefillDate}
      />
    </div>
  )
}

function ShiftModal({ isOpen, onClose, onSave, saving, agents, prefillDate }) {
  const [form, setForm] = useState({
    user_id: '',
    shift_date: prefillDate || '',
    start_time: '09:00',
    end_time: '18:00',
    shift_type: 'regular',
    notes: '',
    breaks: [],
  })

  // Sync prefill date
  if (prefillDate && form.shift_date !== prefillDate && !form._synced) {
    setForm(f => ({ ...f, shift_date: prefillDate, _synced: true }))
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

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
      <form
        onSubmit={e => { e.preventDefault(); onSave({ ...form }) }}
        className="space-y-4"
      >
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

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Start *</label>
            <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">End *</label>
            <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Type</label>
            <select value={form.shift_type} onChange={e => set('shift_type', e.target.value)} className="input w-full">
              <option value="regular">Regular</option>
              <option value="overtime">Overtime</option>
              <option value="on_call">On Call</option>
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
