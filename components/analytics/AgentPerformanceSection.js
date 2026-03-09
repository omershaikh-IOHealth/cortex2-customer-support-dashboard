'use client'

/* NEW: Agent & Team Performance section — leaderboard with rank badges, resolution time chart */

import { useQuery } from '@tanstack/react-query'
import { getAgentStats } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Users } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'rgb(14 19 30)',
    border: '1px solid rgb(30 42 66)',
    borderRadius: '10px',
    color: 'rgb(236 241 255)',
    fontSize: '13px',
  },
  labelStyle: { color: 'rgb(128 148 184)', fontSize: '12px' },
  itemStyle: { color: 'rgb(236 241 255)' },
}

const RANK_STYLES = [
  { bg: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30', bar: '#f59e0b' },
  { bg: 'bg-slate-300/20 text-slate-300 border-slate-300/30',   bar: '#94a3b8' },
  { bg: 'bg-orange-400/20 text-orange-400 border-orange-400/30', bar: '#f97316' },
]

const AVATAR_COLORS = [
  '#4c7cff', '#7c5cfc', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#ec4899', '#8b5cf6',
]

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??'
}

export default function AgentPerformanceSection({ days = 30 }) {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agent-stats', days],
    queryFn: () => getAgentStats(days),
  })

  const maxTickets = agents.length > 0 ? Math.max(...agents.map(a => a.ticket_count)) : 1
  const chartData = agents
    .filter(a => a.avg_resolution_hours != null)
    .slice(0, 10)
    .map(a => ({ name: a.name?.split(' ')[0] || a.email?.split('@')[0], hours: parseFloat(a.avg_resolution_hours) || 0 }))

  const AXIS_STYLE = { stroke: 'rgb(128 148 184)', tick: { fill: 'rgb(128 148 184)', fontSize: 10 } }
  const GRID_STYLE = { strokeDasharray: '3 3', stroke: 'rgb(30 42 66)' }

  return (
    /* NEW: Agent & Team Performance section */
    <div data-new="true" className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-orange-400" />
        <h2 className="font-display font-bold text-cortex-text">Agent &amp; Team Performance</h2>
        <NewBadge description="New section — agent leaderboard ranked by ticket volume, avg resolution time chart." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <div className="card">
          <h3 className="font-semibold text-cortex-text text-sm mb-4">Leaderboard — Ticket Volume</h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-cortex-bg animate-pulse rounded-xl" />)}
            </div>
          ) : agents.length > 0 ? (
            <div className="space-y-2">
              {agents.slice(0, 10).map((agent, i) => {
                const rank = i + 1
                const pct = maxTickets > 0 ? (agent.ticket_count / maxTickets) * 100 : 0
                const rankStyle = RANK_STYLES[i] || null
                const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]

                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-cortex-bg transition-colors group"
                    title={`${agent.name} — ${agent.ticket_count} tickets, avg ${agent.avg_resolution_hours}h resolution`}
                  >
                    {/* Rank */}
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold border flex-shrink-0 ${
                      rankStyle ? rankStyle.bg : 'bg-cortex-surface-raised text-cortex-muted border-cortex-border'
                    }`}>
                      {rank}
                    </span>

                    {/* Avatar */}
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(agent.name)}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-cortex-text truncate">{agent.name || agent.email}</p>
                      <div className="mt-1 h-1 bg-cortex-bg rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: rankStyle ? RANK_STYLES[Math.min(i, 2)].bar : 'rgb(94 163 255)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-mono font-bold text-cortex-text">{agent.ticket_count}</p>
                      <p className="text-[10px] text-cortex-muted">tickets</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center py-10 text-cortex-muted text-sm">No agent data for period</p>
          )}
        </div>

        {/* Resolution Time by Agent */}
        <div className="card">
          <h3 className="font-semibold text-cortex-text text-sm mb-4">Avg Resolution Time by Agent</h3>
          {isLoading ? (
            <div className="h-64 bg-cortex-bg animate-pulse rounded-xl" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid {...GRID_STYLE} horizontal={false} />
                <XAxis type="number" {...AXIS_STYLE} unit="h" />
                <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={64} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [`${v}h`, 'Avg Resolution']} />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]} fill="rgb(124 92 252)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-cortex-muted text-sm">No resolution time data</p>
          )}
        </div>
      </div>
    </div>
  )
}
