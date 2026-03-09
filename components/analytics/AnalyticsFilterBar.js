'use client'

/* NEW: Sticky filter bar for the Analytics page — date range, client, priority, channel, compare toggle, refresh */

import { useState } from 'react'
import { Filter, RefreshCw, X } from 'lucide-react'
import { format } from 'date-fns'
import NewBadge from '@/components/ui/NewBadge'

const DATE_RANGE_OPTIONS = [
  { label: 'Last 7 Days',  value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'Last 90 Days', value: '90' },
  { label: 'This Month',   value: 'month' },
]

export default function AnalyticsFilterBar({
  filters,
  onFilterChange,
  showWoW,
  onToggleWoW,
  companies = [],
  solutions = [],
  onRefresh,
  lastUpdated,
}) {
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    await onRefresh?.()
    setRefreshing(false)
  }

  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    /* NEW: Sticky analytics filter bar */
    <div
      data-new="true"
      className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-cortex-surface/95 backdrop-blur border-b border-cortex-border"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-cortex-muted flex-shrink-0" />
        <NewBadge description="New — sticky filter bar. Filter analytics by date range, client, solution, priority, and channel." />

        {/* Date range */}
        <select
          value={filters.days || '30'}
          onChange={e => onFilterChange('days', e.target.value)}
          className="input py-1.5 text-xs w-36"
        >
          {DATE_RANGE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Client */}
        <select
          value={filters.company_id || ''}
          onChange={e => onFilterChange('company_id', e.target.value)}
          className="input py-1.5 text-xs w-36"
        >
          <option value="">All Clients</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>

        {/* Solution */}
        <select
          value={filters.solution_id || ''}
          onChange={e => onFilterChange('solution_id', e.target.value)}
          className="input py-1.5 text-xs w-36"
          disabled={!solutions.length}
        >
          <option value="">All Solutions</option>
          {solutions.map(s => (
            <option key={s.id} value={s.id}>{s.solution_name}</option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={filters.priority || ''}
          onChange={e => onFilterChange('priority', e.target.value)}
          className="input py-1.5 text-xs w-32"
        >
          <option value="">All Priorities</option>
          <option value="P1">P1 — Critical</option>
          <option value="P2">P2 — High</option>
          <option value="P3">P3 — Medium</option>
          <option value="P4">P4 — Low</option>
        </select>

        {/* Channel */}
        <select
          value={filters.channel || ''}
          onChange={e => onFilterChange('channel', e.target.value)}
          className="input py-1.5 text-xs w-28"
        >
          <option value="">All Channels</option>
          <option value="voice">Voice</option>
          <option value="email">Email</option>
        </select>

        {/* Clear */}
        {activeCount > 1 && (
          <button
            onClick={() => {
              onFilterChange('company_id', '')
              onFilterChange('solution_id', '')
              onFilterChange('priority', '')
              onFilterChange('channel', '')
            }}
            className="flex items-center gap-1 text-xs text-cortex-muted hover:text-cortex-danger transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <div className="flex-1" />

        {/* Compare toggle */}
        <label className="flex items-center gap-2 text-xs text-cortex-muted cursor-pointer select-none">
          <span
            onClick={onToggleWoW}
            className={`relative inline-flex w-8 h-4 rounded-full transition-colors cursor-pointer ${
              showWoW ? 'bg-cortex-accent' : 'bg-cortex-surface-raised border border-cortex-border'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
              showWoW ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </span>
          Compare
        </label>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 text-xs text-cortex-muted hover:text-cortex-text transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          {lastUpdated ? format(lastUpdated, 'HH:mm:ss') : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
