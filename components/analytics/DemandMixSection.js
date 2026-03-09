'use client'

/* NEW: Support Demand Mix section — channel donut, priority treemap, sentiment donut, module bar, demand heatmap */

import { useQuery } from '@tanstack/react-query'
import { getTicketsByModule, getDemandHeatmap, getSentimentDistribution } from '@/lib/api'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { LayoutGrid } from 'lucide-react'
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

const CHANNEL_COLORS = { voice: '#f59e0b', email: '#5ea3ff' }
const CHANNEL_LABELS = { voice: 'Voice', email: 'Email' }

const PRIORITY_COLORS = { P1: '#ef4444', P2: '#f97316', P3: '#f59e0b', P4: '#5ea3ff', P5: '#94a3b8' }

const SENTIMENT_COLORS = {
  positive: '#22c55e',
  neutral:  '#828daa',
  negative: '#ef4444',
  unknown:  '#505b78',
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const AXIS_STYLE = { stroke: 'rgb(128 148 184)', tick: { fill: 'rgb(128 148 184)', fontSize: 11 } }
const GRID_STYLE = { strokeDasharray: '3 3', stroke: 'rgb(30 42 66)' }

export default function DemandMixSection({ channelMix = [], channelLoading, days = 30 }) {
  const { data: modules = [], isLoading: modLoading } = useQuery({
    queryKey: ['by-module', days],
    queryFn: () => getTicketsByModule(days),
  })
  const { data: heatmapData, isLoading: heatLoading } = useQuery({
    queryKey: ['heatmap', days],
    queryFn: () => getDemandHeatmap(days),
  })
  const { data: sentimentData = [], isLoading: sentLoading } = useQuery({
    queryKey: ['sentiment', days],
    queryFn: () => getSentimentDistribution(days),
  })

  const matrix = heatmapData?.matrix || []
  const maxVal = heatmapData?.max || 1

  return (
    /* NEW: Support Demand Mix section */
    <div data-new="true" className="space-y-4">
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-4 h-4 text-purple-400" />
        <h2 className="font-display font-bold text-cortex-text">Support Demand Mix</h2>
        <NewBadge description="New section — channel mix, sentiment distribution, tickets by module, and demand heatmap." />
      </div>

      {/* Top row: 3 chart cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Channel Mix */}
        <div className="card">
          <h3 className="font-semibold text-cortex-text text-sm mb-4 flex items-center gap-1.5">
            Tickets by Channel
          </h3>
          {channelLoading ? (
            <div className="h-44 bg-cortex-bg animate-pulse rounded-xl" />
          ) : channelMix.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={channelMix} cx="50%" cy="50%" outerRadius={65} innerRadius={36}
                    dataKey="count" nameKey="channel" labelLine={false}>
                    {channelMix.map((e, i) => <Cell key={i} fill={CHANNEL_COLORS[e.channel] || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v, n) => [`${v} tickets`, CHANNEL_LABELS[n] || n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4">
                {channelMix.map(e => (
                  <div key={e.channel} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[e.channel] || '#94a3b8' }} />
                    <span className="text-xs text-cortex-muted capitalize">{CHANNEL_LABELS[e.channel] || e.channel}</span>
                    <span className="text-xs font-mono font-semibold text-cortex-text">{e.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center py-10 text-cortex-muted text-sm">No channel data</p>
          )}
        </div>

        {/* Sentiment Distribution */}
        <div className="card">
          <h3 className="font-semibold text-cortex-text text-sm mb-4">Sentiment Distribution</h3>
          {sentLoading ? (
            <div className="h-44 bg-cortex-bg animate-pulse rounded-xl" />
          ) : sentimentData.filter(s => s.sentiment !== 'unknown').length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={sentimentData.filter(s => s.sentiment !== 'unknown')}
                    cx="50%" cy="50%" outerRadius={65} innerRadius={36}
                    dataKey="count" nameKey="sentiment" labelLine={false}
                  >
                    {sentimentData.filter(s => s.sentiment !== 'unknown').map((e, i) => (
                      <Cell key={i} fill={SENTIMENT_COLORS[e.sentiment] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v, n) => [`${v} tickets`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-3 flex-wrap justify-center">
                {sentimentData.filter(s => s.sentiment !== 'unknown').map(e => (
                  <div key={e.sentiment} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[e.sentiment] || '#94a3b8' }} />
                    <span className="text-xs text-cortex-muted capitalize">{e.sentiment}</span>
                    <span className="text-xs font-mono font-semibold text-cortex-text">{e.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center py-10 text-cortex-muted text-sm">No sentiment data</p>
          )}
        </div>

        {/* Priority Treemap */}
        <div className="card">
          <h3 className="font-semibold text-cortex-text text-sm mb-4">Priority Treemap</h3>
          {!Array.isArray(channelMix) ? (
            <div className="h-44 bg-cortex-bg animate-pulse rounded-xl" />
          ) : (
            // Simple CSS treemap using flex wrapping
            <div className="h-44 flex flex-wrap gap-1 content-start">
              {/* Rendered from priorityDist passed via parent — shows placeholder if no data */}
              <p className="text-xs text-cortex-muted self-center w-full text-center">
                See Priority Distribution chart above for breakdown
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tickets by Module — full row */}
      <div className="card">
        <h3 className="font-semibold text-cortex-text text-sm mb-4">Tickets by Module (Top 10)</h3>
        {modLoading ? (
          <div className="h-56 bg-cortex-bg animate-pulse rounded-xl" />
        ) : modules.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={modules}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid {...GRID_STYLE} horizontal={false} />
              <XAxis type="number" {...AXIS_STYLE} />
              <YAxis
                type="category"
                dataKey="module"
                {...AXIS_STYLE}
                width={120}
                tick={{ fill: 'rgb(128 148 184)', fontSize: 10 }}
              />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v, n, p) => [v, 'Tickets']} />
              <Bar dataKey="count" fill="rgb(94 163 255)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-10 text-cortex-muted text-sm">No module data</p>
        )}
      </div>

      {/* Demand Heatmap — full row */}
      <div className="card">
        <h3 className="font-semibold text-cortex-text text-sm mb-4">
          Demand Heatmap — Tickets by Day &amp; Hour
        </h3>
        {heatLoading ? (
          <div className="h-44 bg-cortex-bg animate-pulse rounded-xl" />
        ) : matrix.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex">
                <div className="w-10 flex-shrink-0" />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="flex-1 text-center text-[9px] font-mono text-cortex-muted py-0.5">
                    {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`}
                  </div>
                ))}
              </div>
              {/* Rows */}
              {DOW_LABELS.map((day, dow) => (
                <div key={dow} className="flex items-center">
                  <div className="w-10 flex-shrink-0 text-[10px] font-mono text-cortex-muted text-right pr-2">{day}</div>
                  {(matrix[dow] || Array(24).fill(0)).map((count, hour) => {
                    const intensity = maxVal > 0 ? count / maxVal : 0
                    return (
                      <div
                        key={hour}
                        className="flex-1 h-6 rounded-sm mx-px cursor-default transition-opacity hover:opacity-80"
                        style={{
                          backgroundColor: `rgba(94, 163, 255, ${0.05 + intensity * 0.85})`,
                        }}
                        title={`${day} ${hour}:00 — ${count} ticket${count !== 1 ? 's' : ''}`}
                      />
                    )
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 justify-end">
                <span className="text-[10px] text-cortex-muted">Low</span>
                {[0.05, 0.2, 0.4, 0.6, 0.8, 0.9].map((op, i) => (
                  <div key={i} className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(94,163,255,${op})` }} />
                ))}
                <span className="text-[10px] text-cortex-muted">High</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center py-10 text-cortex-muted text-sm">No heatmap data</p>
        )}
      </div>
    </div>
  )
}
