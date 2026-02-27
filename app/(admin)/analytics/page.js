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

const COLORS = {
  P1: '#dc2626', P2: '#ef4444', P3: '#f59e0b', P4: '#3b82f6', P5: '#64748b'
}

const tooltipStyle = {
  contentStyle: { backgroundColor: '#121827', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' },
  labelStyle: { color: '#94a3b8', marginBottom: '4px' },
  itemStyle: { color: '#f1f5f9' },
}

export default function AnalyticsPage() {
  const [showWoW, setShowWoW] = useState(false)
  const [filters, setFilters] = useState({ company_id: '', solution_id: '', priority: '' })

  const activeFilters = Object.values(filters).filter(Boolean).length

  const { data: companies = [] } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: getAdminCompanies,
  })

  const { data: allSolutions = [] } = useQuery({
    queryKey: ['all-solutions'],
    queryFn: getAllSolutions,
  })

  // Filter solutions by selected company
  const solutions = filters.company_id
    ? allSolutions.filter(s => String(s.company_id) === String(filters.company_id))
    : allSolutions

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends', filters],
    queryFn: () => getTrends({
      ...(filters.company_id && { company_id: filters.company_id }),
      ...(filters.solution_id && { solution_id: filters.solution_id }),
      ...(filters.priority && { priority: filters.priority }),
    }),
  })

  const { data: priorityDist, isLoading: priorityLoading } = useQuery({
    queryKey: ['priority-distribution'],
    queryFn: getPriorityDistribution,
  })

  const currentTrends = trendsData?.current || (Array.isArray(trendsData) ? trendsData : [])
  const previousTrends = trendsData?.previous || []

  const mergedTrends = currentTrends.map((day, i) => ({
    ...day,
    prev_total_tickets: previousTrends[i]?.total_tickets ?? null,
    prev_high_priority: previousTrends[i]?.high_priority ?? null,
  }))

  const setFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      // Reset solution when company changes
      if (key === 'company_id') next.solution_id = ''
      return next
    })
  }

  const clearFilters = () => setFilters({ company_id: '', solution_id: '', priority: '' })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">Analytics</h1>
        <p className="text-cortex-muted">Performance insights and trends</p>
      </div>

      {/* 30-Day Trends Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-cortex-accent" />
            <h2 className="text-xl font-display font-bold">30-Day Ticket Trends</h2>
          </div>
          <button
            onClick={() => setShowWoW(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showWoW
                ? 'bg-cortex-accent/10 text-cortex-accent border-cortex-accent/30'
                : 'bg-cortex-bg text-cortex-muted border-cortex-border hover:border-cortex-muted'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            WoW Comparison
          </button>
        </div>

        {/* Trend Filters */}
        <div className="flex items-center gap-3 mb-6 p-3 bg-cortex-bg rounded-lg border border-cortex-border">
          <Filter className="w-4 h-4 text-cortex-muted shrink-0" />
          <select
            value={filters.company_id}
            onChange={e => setFilter('company_id', e.target.value)}
            className="input text-sm py-1.5 flex-1"
          >
            <option value="">All Clients</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
          <select
            value={filters.solution_id}
            onChange={e => setFilter('solution_id', e.target.value)}
            className="input text-sm py-1.5 flex-1"
            disabled={!solutions.length}
          >
            <option value="">All Solutions</option>
            {solutions.map(s => (
              <option key={s.id} value={s.id}>{s.solution_name}</option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={e => setFilter('priority', e.target.value)}
            className="input text-sm py-1.5 w-36"
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 - Critical</option>
            <option value="P2">P2 - High</option>
            <option value="P3">P3 - Medium</option>
            <option value="P4">P4 - Low</option>
            <option value="P5">P5 - Minimal</option>
          </select>
          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-cortex-muted hover:text-cortex-danger transition-colors whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Clear ({activeFilters})
            </button>
          )}
        </div>

        {trendsLoading ? (
          <div className="h-80 bg-cortex-bg animate-pulse rounded-lg" />
        ) : mergedTrends.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={mergedTrends}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={v => { try { return format(new Date(v), 'MMM d') } catch { return v } }}
              />
              <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={v => { try { return format(new Date(v), 'MMM d, yyyy') } catch { return v } }}
              />
              {showWoW && <Legend wrapperStyle={{ color: '#94a3b8' }} />}
              <Area type="monotone" dataKey="total_tickets" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" name="Total (current)" />
              <Area type="monotone" dataKey="high_priority" stroke="#ef4444" fillOpacity={1} fill="url(#colorHigh)" name="High Priority (current)" />
              {showWoW && (
                <>
                  <Area type="monotone" dataKey="prev_total_tickets" stroke="#3b82f6" strokeDasharray="5 5" fill="none" strokeOpacity={0.4} name="Total (prev period)" />
                  <Area type="monotone" dataKey="prev_high_priority" stroke="#ef4444" strokeDasharray="5 5" fill="none" strokeOpacity={0.4} name="High Priority (prev)" />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-12 text-cortex-muted">No trend data for the selected filters</p>
        )}
      </div>

      {/* Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-display font-bold mb-6">Priority Distribution</h2>
          {priorityLoading ? (
            <div className="h-64 bg-cortex-bg animate-pulse rounded-lg" />
          ) : priorityDist?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityDist}
                  cx="50%" cy="50%"
                  labelLine={false}
                  label={({ priority, count }) => `${priority}: ${count}`}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="priority"
                >
                  {priorityDist.map((entry, i) => (
                    <Cell key={i} fill={COLORS[entry.priority] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, name) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-cortex-muted">No distribution data</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-display font-bold mb-6">SLA by Priority</h2>
          {priorityLoading ? (
            <div className="h-64 bg-cortex-bg animate-pulse rounded-lg" />
          ) : priorityDist?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="priority" stroke="#64748b" tick={{ fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} unit="%" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) => [`${value}%`, 'Avg SLA Consumed']}
                  labelFormatter={(label) => `Priority: ${label}`}
                />
                <Bar dataKey="avg_sla_consumption" name="Avg SLA %">
                  {priorityDist.map((entry, i) => (
                    <Cell key={i} fill={COLORS[entry.priority] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-cortex-muted">No SLA data</p>
          )}
        </div>
      </div>

      {/* Priority Breakdown with Avg Resolution Time */}
      {priorityDist?.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-display font-bold mb-6">Priority Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {priorityDist.map(item => (
              <div key={item.priority} className="p-4 bg-cortex-bg rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[item.priority] }} />
                  <span className="font-semibold">{item.priority}</span>
                </div>
                <p className="text-3xl font-display font-bold mb-1">{item.count}</p>
                <p className="text-sm text-cortex-muted">Avg SLA: {item.avg_sla_consumption || 0}%</p>
                <p className="text-sm text-cortex-muted">
                  Avg resolve: {item.avg_resolution_hours != null ? `${item.avg_resolution_hours}h` : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
