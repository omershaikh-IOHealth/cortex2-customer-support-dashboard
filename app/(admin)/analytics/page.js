'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTrends, getPriorityDistribution, getAdminCompanies, getAllSolutions, getChannelMix,
  getKPISummary, getAgingDistribution, getTicketsByModule, getDemandHeatmap, getAgentStats,
  getSentimentDistribution,
} from '@/lib/api'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, BarChart2, AlertTriangle, LayoutGrid, Users, Search, Radio } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'
import AnalyticsFilterBar from '@/components/analytics/AnalyticsFilterBar'
import KPIStrip from '@/components/analytics/KPIStrip'
import SLASection from '@/components/analytics/SLASection'
import DemandMixSection from '@/components/analytics/DemandMixSection'
import AgentPerformanceSection from '@/components/analytics/AgentPerformanceSection'
import RootCauseSection from '@/components/analytics/RootCauseSection'
import { format } from 'date-fns'

const PRIORITY_COLORS = {
  P1: '#ef4444', P2: '#f97316', P3: '#f59e0b', P4: '#5ea3ff', P5: '#94a3b8',
}

const CHANNEL_COLORS = { voice: '#f59e0b', email: '#5ea3ff' }
const CHANNEL_LABELS = { voice: 'Voice', email: 'Email' }

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
  itemStyle: { color: 'rgb(236 241 255)' },
}

export default function AnalyticsPage() {
  const qc = useQueryClient()
  const [showWoW, setShowWoW] = useState(false)
  const [filters, setFilters] = useState({ days: '30', company_id: '', solution_id: '', priority: '', channel: '' })
  const [lastUpdated, setLastUpdated] = useState(null)
  const [trendTab, setTrendTab] = useState('volume')

  const days = parseInt(filters.days || '30')

  const setFilter = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'company_id') next.solution_id = ''
      return next
    })
  }, [])

  const handleRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['analytics'] })
    await qc.invalidateQueries({ queryKey: ['trends'] })
    await qc.invalidateQueries({ queryKey: ['kpi-summary'] })
    await qc.invalidateQueries({ queryKey: ['priority-distribution'] })
    await qc.invalidateQueries({ queryKey: ['channel-mix'] })
    setLastUpdated(new Date())
  }, [qc])

  const { data: companies = [] } = useQuery({ queryKey: ['admin-companies'], queryFn: getAdminCompanies })
  const { data: allSolutions = [] } = useQuery({ queryKey: ['all-solutions'], queryFn: getAllSolutions })

  const solutions = filters.company_id
    ? allSolutions.filter(s => String(s.company_id) === String(filters.company_id))
    : allSolutions

  const trendsParams = {
    ...(filters.company_id && { company_id: filters.company_id }),
    ...(filters.solution_id && { solution_id: filters.solution_id }),
    ...(filters.priority && { priority: filters.priority }),
  }

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['trends', trendsParams],
    queryFn: () => getTrends(trendsParams),
  })
  const { data: priorityDist, isLoading: priorityLoading } = useQuery({
    queryKey: ['priority-distribution'],
    queryFn: getPriorityDistribution,
  })
  const { data: channelMix = [], isLoading: channelLoading } = useQuery({
    queryKey: ['channel-mix'],
    queryFn: getChannelMix,
    refetchInterval: 60000,
  })

  const currentTrends = trendsData?.current || (Array.isArray(trendsData) ? trendsData : [])
  const previousTrends = trendsData?.previous || []
  const mergedTrends = currentTrends.map((day, i) => ({
    ...day,
    prev_total_tickets: previousTrends[i]?.total_tickets ?? null,
    prev_high_priority: previousTrends[i]?.high_priority ?? null,
  }))

  const AXIS_STYLE = { stroke: 'rgb(128 148 184)', tick: { fill: 'rgb(128 148 184)', fontSize: 11 } }
  const GRID_STYLE = { strokeDasharray: '3 3', stroke: 'rgb(30 42 66)' }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Page header */}
      <div>
        <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Insights</p>
        <h1 className="text-3xl font-display font-bold text-cortex-text">Analytics</h1>
      </div>

      {/* NEW: Sticky filter bar */}
      <AnalyticsFilterBar
        filters={filters}
        onFilterChange={setFilter}
        showWoW={showWoW}
        onToggleWoW={() => setShowWoW(v => !v)}
        companies={companies}
        solutions={solutions}
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
      />

      {/* NEW: KPI Strip */}
      <KPIStrip days={days} />

      {/* 30-Day Ticket Trends — Operations Overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cortex-accent" />
            <h2 className="font-display font-bold text-cortex-text">30-Day Ticket Trends</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-cortex-bg rounded-lg border border-cortex-border">
              {[['volume', 'Volume'], ['resolution', 'Resolution Time']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTrendTab(key)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                    trendTab === key
                      ? 'bg-cortex-surface text-cortex-text shadow-sm'
                      : 'text-cortex-muted hover:text-cortex-text'
                  }`}
                >
                  {label}
                </button>
              ))}
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
              WoW
            </button>
          </div>
        </div>

        {trendsLoading ? (
          <div className="h-80 bg-cortex-bg animate-pulse rounded-xl" />
        ) : mergedTrends.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            {trendTab === 'volume' ? (
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
            ) : (
              /* Resolution time tab — uses avg_consumption as proxy until dedicated endpoint */
              <AreaChart data={mergedTrends} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSLA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="rgb(245 158 11)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="rgb(245 158 11)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={v => { try { return format(new Date(v), 'MMM d') } catch { return v } }} />
                <YAxis {...AXIS_STYLE} unit="%" />
                <Tooltip {...TOOLTIP_STYLE}
                  formatter={v => [`${v}%`, 'Avg SLA Consumption']}
                  labelFormatter={v => { try { return format(new Date(v), 'MMM d, yyyy') } catch { return v } }}
                />
                <Area type="monotone" dataKey="avg_consumption" stroke="rgb(245 158 11)" fill="url(#gSLA)" strokeWidth={2} name="Avg SLA %" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-14 text-cortex-muted">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No trend data for the selected filters</p>
          </div>
        )}
      </div>

      {/* NEW: SLA & Escalation Intelligence */}
      <SLASection priorityDist={priorityDist} priorityLoading={priorityLoading} days={days} />

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

      {/* NEW: Support Demand Mix */}
      <DemandMixSection channelMix={channelMix} channelLoading={channelLoading} days={days} />

      {/* NEW: Agent & Team Performance */}
      <AgentPerformanceSection days={days} />

      {/* NEW: Root Cause Analysis */}
      <RootCauseSection days={days} />

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
