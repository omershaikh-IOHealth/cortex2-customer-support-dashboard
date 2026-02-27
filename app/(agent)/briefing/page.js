'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { BookOpen, Info, Calendar, Clock, Coffee, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useMemo } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { getCirculars } from '@/lib/api'

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
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function BriefingPage() {
  const { data: session } = useSession()
  const [weekBase, setWeekBase] = useState(new Date())
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

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-cortex-text">
          Good {getGreeting()}, {session?.user?.name?.split(' ')[0] || 'Agent'}
        </h1>
        <p className="text-cortex-muted text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-cortex-warning" />
            <h2 className="font-semibold text-cortex-text">Specific Info</h2>
          </div>
          <div className="space-y-2 text-sm text-cortex-muted">
            <div className="flex items-center justify-between py-1.5 border-b border-cortex-border">
              <span>Queue</span>
              <span className="text-cortex-text font-mono">iohealth</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-cortex-border">
              <span>Role</span>
              <span className="badge text-cortex-success bg-cortex-success/10 capitalize">
                {session?.user?.role}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span>ZIWO</span>
              <span className="text-cortex-text text-xs font-mono truncate max-w-[160px]">
                {session?.user?.ziwoEmail || 'Not linked'}
              </span>
            </div>
          </div>
        </div>

        <div className="card flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-cortex-success" />
            <h2 className="font-semibold text-cortex-text">Circulars</h2>
          </div>
          <p className="text-4xl font-display font-bold text-cortex-text">
            {activeCirculars.length}
          </p>
          <p className="text-xs text-cortex-muted mt-1">active · scroll down to read</p>
        </div>
      </div>

      {/* ── Weekly Rota ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cortex-accent" />
            <h2 className="font-semibold text-cortex-text">My Schedule</h2>
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

        <div className="grid grid-cols-7 gap-1">
          {weekDates.map(date => {
            const key = fmt(date)
            const shift = shiftsByDate[key]
            const isToday = key === today
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
            const dayNum  = date.getDate()

            return (
              <div
                key={key}
                className={`rounded-lg border p-2 min-h-[90px] flex flex-col
                  ${isToday ? 'border-cortex-accent bg-cortex-accent/5' : 'border-cortex-border'}`}
              >
                <div className="text-center mb-1">
                  <p className="text-xs text-cortex-muted">{dayName}</p>
                  <p className={`text-sm font-bold ${isToday ? 'text-cortex-accent' : 'text-cortex-text'}`}>{dayNum}</p>
                </div>
                {shift ? (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1 text-cortex-text font-mono">
                      <Clock className="w-2.5 h-2.5 text-cortex-muted shrink-0" />
                      {shift.start_time?.slice(0,5)}–{shift.end_time?.slice(0,5)}
                    </div>
                    {shift.breaks?.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-cortex-warning">
                        <Coffee className="w-2.5 h-2.5 shrink-0" />
                        {b.break_start?.slice(0,5)}–{b.break_end?.slice(0,5)}
                      </div>
                    ))}
                    {shift.shift_type !== 'regular' && (
                      <span className="badge text-xs text-cortex-warning bg-cortex-warning/10 capitalize">
                        {shift.shift_type}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-cortex-muted text-center mt-2">—</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Circulars ── */}
      <div>
        <h2 className="font-semibold text-cortex-text mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cortex-success" />
          Circulars &amp; Knowledge Updates
        </h2>
        {circLoading ? (
          <div className="card animate-pulse h-24" />
        ) : activeCirculars.length === 0 ? (
          <div className="card text-center py-10">
            <BookOpen className="w-8 h-8 text-cortex-muted mx-auto mb-2" />
            <p className="text-cortex-muted text-sm">No circulars published yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCirculars.map(c => (
              <div key={c.id} className="card hover:border-cortex-accent/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-cortex-text mb-1 truncate">{c.title}</h3>
                    <p className="text-sm text-cortex-muted line-clamp-2">{c.content}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {c.category && (
                        <span className="badge text-cortex-accent bg-cortex-accent/10 text-xs">{c.category}</span>
                      )}
                      {c.tags?.map(tag => (
                        <span key={tag} className="badge text-cortex-muted bg-cortex-border/50 text-xs">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-cortex-muted whitespace-nowrap shrink-0">
                    {formatRelativeTime(c.updated_at || c.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
