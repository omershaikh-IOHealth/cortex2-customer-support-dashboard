'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { BookOpen, Info, Calendar, Clock, Coffee, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { useState, useMemo } from 'react'
import { formatRelativeTime } from '@/lib/utils'
import { getCirculars } from '@/lib/api'
import { cn } from '@/lib/utils'

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
  const todayShift = shiftsByDate[today]
  const firstName = session?.user?.name?.split(' ')[0] || 'Agent'

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
    </div>
  )
}
