'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTrends, getPriorityDistribution, getAdminCompanies, getAllSolutions } from '@/lib/api'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, BarChart2, Filter, X } from 'lucide-react'
import { format } from 'date-fns'

const PRIORITY_COLORS = {
  P1: '#ef4444', P2: '#f97316', P3: '#f59e0b', P4: '#5ea3ff', P5: '#94a3b8',
}

// Tooltip shared style — works in both light and dark
const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'rgb(14 19 30)',
    border: '1px solid rgb(30 42 66)',
    borderRadius: '10px',
    color: 'rgb(236 241 255)',
    fontSize: '13px',
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.4)',
  },
  labelStyle: { color: 'rgb(128 148 184)', marginBottom: '4px', fontSize: '12px' },
  itemStyle:  { color: 'rgb(236 241 255)' },
}

export default function AnalyticsPage() {
  const [showWoW, setShowWoW] = useState(false)
  const [filters, setFilters] = useState({ company_id: '', solution_id: '', priority: '' })

  const activeFilters = Object.values(filters).filter(Boolean).length

  const { data: companies = [] }   = useQuery({ queryKey: ['admin-companies'],  queryFn: getAdminCompanies })
  const { data: allSolutions = [] } = useQuery({ queryKey: ['all-solutions'],    queryFn: getAllSolutions })

  const solutions = filters.company_id
    ? allSolutions.filter(s => String(s.company_id) === String(filters.company_id))
    : allSolutions

  const { data: trendsData,   isLoading: trendsLoading }   = useQuery({
    queryKey: ['trends', filters],
    queryFn: () => getTrends({
      ...(filters.company_id   && { company_id:   filters.company_id }),
      ...(filters.solution_id  && { solution_id:  filters.solution_id }),
      ...(filters.priority     && { priority:     filters.priority }),
    }),
  })
  const { data: priorityDist, isLoading: priorityLoading } = useQuery({
    queryKey: ['priority-distribution'],
    queryFn: getPriorityDistribution,
  })

  const currentTrends  = trendsData?.current  || (Array.isArray(trendsData) ? trendsData : [])
  const previousTrends = trendsData?.previous || []
  const mergedTrends   = currentTrends.map((day, i) => ({
    ...day,
    prev_total_tickets: previousTrends[i]?.total_tickets ?? null,
    prev_high_priority: previousTrends[i]?.high_priority ?? null,
  }))

  const setFilter = (key, value) => setFilters(prev => {
    const next = { ...prev, [key]: value }
    if (key === 'company_id') next.solution_id = ''
    return next
  })
  const clearFilters = () => setFilters({ company_id: '', solution_id: '', priority: '' })

  const AXIS_STYLE = { stroke: 'rgb(128 148 184)', tick: { fill: 'rgb(128 148 184)', fontSize: 11 } }
  const GRID_STYLE = { strokeDasharray: '3 3', stroke: 'rgb(30 42 66)' }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Insights</p>
        <h1 className="text-3xl font-display font-bold text-cortex-text">Analytics</h1>
      </div>

      {/* 30-day trends */}
      <div className="card">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cortex-accent" />
            <h2 className="font-display font-bold text-cortex-text">30-Day Ticket Trends</h2>
          </div>
          <button
            onClick={() => setShowWoW(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showWoW
                ? 'bg-cortex-accent/10 text-cortex-accent border-cortex-accent/30'
                : 'bg-cortex-surface-raised text-cortex-muted border-cortex-border hover:border-cortex-border-strong'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            WoW Comparison
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 p-3 bg-cortex-bg rounded-xl border border-cortex-border flex-wrap">
          <Filter className="w-4 h-4 text-cortex-muted flex-shrink-0" />
          <select value={filters.company_id} onChange={e => setFilter('company_id', e.target.value)} className="input flex-1 min-w-32 text-sm py-1.5">
            <option value="">All Clients</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <select value={filters.solution_id} onChange={e => setFilter('solution_id', e.target.value)} className="input flex-1 min-w-32 text-sm py-1.5" disabled={!solutions.length}>
            <option value="">All Solutions</option>
            {solutions.map(s => <option key={s.id} value={s.id}>{s.solution_name}</option>)}
          </select>
          <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)} className="input w-36 text-sm py-1.5">
            <option value="">All Priorities</option>
            <option value="P1">P1 — Critical</option>
            <option value="P2">P2 — High</option>
            <option value="P3">P3 — Medium</option>
            <option value="P4">P4 — Low</option>
          </select>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-cortex-muted hover:text-cortex-danger transition-colors whitespace-nowrap">
              <X className="w-3.5 h-3.5" /> Clear ({activeFilters})
            </button>
          )}
        </div>

        {trendsLoading ? (
          <div className="h-80 bg-cortex-bg animate-pulse rounded-xl" />
        ) : mergedTrends.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={mergedTrends} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="rgb(94 163 255)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="rgb(94 163 255)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="rgb(251 99 94)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="rgb(251 99 94)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={v => { try { return format(new Date(v), 'MMM d') } catch { return v } }} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} labelFormatter={v => { try { return format(new Date(v), 'MMM d, yyyy') } catch { return v } }} />
              {showWoW && <Legend wrapperStyle={{ color: 'rgb(128 148 184)', fontSize: '12px' }} />}
              <Area type="monotone" dataKey="total_tickets" stroke="rgb(94 163 255)"  fill="url(#gTotal)" strokeWidth={2} name="Total (current)" />
              <Area type="monotone" dataKey="high_priority" stroke="rgb(251 99 94)"   fill="url(#gHigh)"  strokeWidth={2} name="High Priority (current)" />
              {showWoW && (
                <>
                  <Area type="monotone" dataKey="prev_total_tickets" stroke="rgb(94 163 255)"  fill="none" strokeDasharray="5 5" strokeOpacity={0.4} name="Total (prev)" />
                  <Area type="monotone" dataKey="prev_high_priority" stroke="rgb(251 99 94)"   fill="none" strokeDasharray="5 5" strokeOpacity={0.4} name="High Priority (prev)" />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-14 text-cortex-muted">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No trend data for the selected filters</p>
          </div>
        )}
      </div>

      {/* Priority charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-display font-bold text-cortex-text mb-5">Priority Distribution</h2>
          {priorityLoading ? (
            <div className="h-64 bg-cortex-bg animate-pulse rounded-xl" />
          ) : priorityDist?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={priorityDist} cx="50%" cy="50%" outerRadius={95} innerRadius={40}
                  labelLine={false} label={({ priority, count }) => `${priority}: ${count}`}
                  dataKey="count" nameKey="priority">
                  {priorityDist.map((e, i) => <Cell key={i} fill={PRIORITY_COLORS[e.priority] || '#94a3b8'} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-cortex-muted">No distribution data</p>
          )}
        </div>

        <div className="card">
          <h2 className="font-display font-bold text-cortex-text mb-5">Avg SLA by Priority</h2>
          {priorityLoading ? (
            <div className="h-64 bg-cortex-bg animate-pulse rounded-xl" />
          ) : priorityDist?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priorityDist} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="priority" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} unit="%" />
                <Tooltip {...TOOLTIP_STYLE}
                  formatter={v => [`${v}%`, 'Avg SLA']}
                  labelFormatter={l => `Priority: ${l}`}
                />
                <Bar dataKey="avg_sla_consumption" radius={[4, 4, 0, 0]}>
                  {priorityDist.map((e, i) => <Cell key={i} fill={PRIORITY_COLORS[e.priority] || '#94a3b8'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-cortex-muted">No SLA data</p>
          )}
        </div>
      </div>

      {/* Priority breakdown cards */}
      {priorityDist?.length > 0 && (
        <div className="card">
          <h2 className="font-display font-bold text-cortex-text mb-5">Priority Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {priorityDist.map(item => (
              <div key={item.priority} className="p-4 rounded-xl bg-cortex-bg border border-cortex-border">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[item.priority] }} />
                  <span className="font-mono font-semibold text-sm text-cortex-text">{item.priority}</span>
                </div>
                <p className="text-3xl font-display font-bold text-cortex-text mb-1">{item.count}</p>
                <p className="text-xs text-cortex-muted">SLA avg: {item.avg_sla_consumption || 0}%</p>
                <p className="text-xs text-cortex-muted">
                  Resolve: {item.avg_resolution_hours != null ? `${item.avg_resolution_hours}h` : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
