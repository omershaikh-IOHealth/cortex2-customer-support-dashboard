'use client'

/* NEW: Agent Performance View — QA pass/fail donut + per-agent score cards */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getQAAgentPerformance } from '@/lib/api'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import NewBadge from '@/components/ui/NewBadge'
import { Users } from 'lucide-react'

const DONUT_COLORS = {
  pass:             '#22c55e',
  borderline:       '#f59e0b',
  coaching_required:'#3b82f6',
  fail:             '#f97316',
  critical_fail:    '#ef4444',
}

const RESULT_LABELS = {
  pass:             'Pass',
  borderline:       'Borderline',
  coaching_required:'Coaching Req.',
  fail:             'Fail',
  critical_fail:    'Critical Fail',
}

const AVATAR_COLORS = [
  'bg-cortex-accent/20 text-cortex-accent',
  'bg-cortex-success/20 text-cortex-success',
  'bg-cortex-warning/20 text-cortex-warning',
  'bg-purple-400/20 text-purple-400',
  'bg-blue-400/20 text-blue-400',
  'bg-teal-400/20 text-teal-400',
  'bg-orange-400/20 text-orange-400',
  'bg-pink-400/20 text-pink-400',
]

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function scoreBorderColor(score) {
  if (score === null || score === undefined) return 'border-cortex-border'
  if (score >= 85) return 'border-cortex-success'
  if (score >= 70) return 'border-cortex-warning'
  return 'border-cortex-danger'
}

function scoreBadgeColor(score) {
  if (score === null || score === undefined) return 'text-cortex-muted'
  if (score >= 85) return 'text-cortex-success'
  if (score >= 70) return 'text-cortex-warning'
  return 'text-cortex-danger'
}

const TOOLTIP_STYLE = {
  backgroundColor: 'rgb(var(--cortex-surface))',
  border: '1px solid rgb(var(--cortex-border))',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'rgb(var(--cortex-text))',
}

export default function AgentPerformanceView({ days = 30 }) {
  /* NEW: Agent Performance View */
  const [search, setSearch] = useState('')
  const [periodDays, setPeriodDays] = useState(days)

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['qa-agent-perf', periodDays],
    queryFn: () => getQAAgentPerformance(periodDays),
    refetchInterval: 60_000,
  })

  // Build donut data from aggregated counts
  const totals = agents.reduce((acc, a) => {
    acc.pass             += a.pass_count
    acc.borderline       += a.borderline_count
    acc.coaching_required+= a.coaching_count
    acc.fail             += a.fail_count
    acc.critical_fail    += a.critical_fail_count
    return acc
  }, { pass: 0, borderline: 0, coaching_required: 0, fail: 0, critical_fail: 0 })

  const donutData = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: RESULT_LABELS[key], value, color: DONUT_COLORS[key] }))

  const filtered = agents.filter(a =>
    !search || a.agent_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    /* NEW: Agent Performance View */
    <div data-new="true" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-orange-400" />
          <h2 className="font-display font-bold text-cortex-text">Agent QA Performance</h2>
          <NewBadge description="New view — per-agent QA scores, pass rates, and distribution chart." />
        </div>
        <select
          value={periodDays}
          onChange={e => setPeriodDays(parseInt(e.target.value))}
          className="input text-sm py-1.5 w-36"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut chart */}
        <div className="card">
          <h3 className="font-semibold text-cortex-text text-sm mb-4">QA Result Distribution</h3>
          {isLoading ? (
            <div className="h-48 bg-cortex-bg animate-pulse rounded-xl" />
          ) : donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [value, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-cortex-muted text-sm">
              No review data for this period
            </div>
          )}
        </div>

        {/* Agent cards grid */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search agents…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input w-full text-sm"
          />

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-cortex-bg animate-pulse rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex items-center justify-center py-16 text-cortex-muted text-sm">
              {search ? 'No agents match your search' : 'No QA reviews found for this period'}
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filtered.map((agent, i) => (
                <div
                  key={agent.agent_id}
                  className={`card border-l-4 ${scoreBorderColor(agent.avg_score)} flex items-center gap-4`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    {initials(agent.agent_name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-cortex-text truncate">{agent.agent_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-cortex-muted">{agent.total_reviews} reviews</span>
                      <span className="text-[10px] text-cortex-success">{agent.pass_count} pass</span>
                      {agent.fail_count > 0 && (
                        <span className="text-[10px] text-cortex-danger">{agent.fail_count} fail</span>
                      )}
                      {agent.critical_fail_count > 0 && (
                        <span className="text-[10px] bg-cortex-danger/15 text-cortex-danger px-1 rounded font-mono">
                          {agent.critical_fail_count} crit
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xl font-display font-bold ${scoreBadgeColor(agent.avg_score)}`}>
                      {agent.avg_score !== null ? agent.avg_score : '—'}
                    </p>
                    <p className="text-[10px] text-cortex-muted">{agent.pass_rate}% pass rate</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
