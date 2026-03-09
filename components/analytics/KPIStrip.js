'use client'

/* NEW: KPI Strip — 6 metric cards with sparklines, trend chips, and status dots */

import { useQuery } from '@tanstack/react-query'
import { getKPISummary, getTrends } from '@/lib/api'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'

function getInitials(str = '') {
  return str
}

const KPI_DEFS = [
  {
    key: 'total_tickets',
    label: 'Total Tickets',
    format: v => v?.toLocaleString() ?? '—',
    deltaKey: 'total_tickets',
    // higher is warn
    status: v => v > 200 ? 'warn' : 'good',
    sparkKey: 'total_tickets',
  },
  {
    key: 'avg_resolution_hours',
    label: 'Avg Resolution',
    format: v => v != null ? `${v}h` : '—',
    deltaKey: 'avg_resolution_hours',
    status: v => v == null ? 'neutral' : v > 72 ? 'bad' : v > 24 ? 'warn' : 'good',
    sparkKey: null,
  },
  {
    key: 'sla_compliance_pct',
    label: 'SLA Compliance',
    format: v => v != null ? `${v}%` : '—',
    deltaKey: 'sla_compliance_pct',
    status: v => v == null ? 'neutral' : v >= 90 ? 'good' : v >= 75 ? 'warn' : 'bad',
    sparkKey: null,
  },
  {
    key: 'escalation_rate_pct',
    label: 'Escalation Rate',
    format: v => v != null ? `${v}%` : '—',
    deltaKey: 'escalation_rate_pct',
    status: v => v == null ? 'neutral' : v <= 5 ? 'good' : v <= 15 ? 'warn' : 'bad',
    sparkKey: null,
  },
  {
    key: 'p1_open',
    label: 'P1 Open',
    format: v => v?.toString() ?? '—',
    deltaKey: null,
    status: v => v == null ? 'neutral' : v === 0 ? 'good' : v <= 3 ? 'warn' : 'bad',
    sparkKey: null,
  },
  {
    key: 'neg_sentiment_pct',
    label: 'Neg Sentiment',
    format: v => v != null ? `${v}%` : '—',
    deltaKey: 'neg_sentiment_pct',
    status: v => v == null ? 'neutral' : v <= 10 ? 'good' : v <= 20 ? 'warn' : 'bad',
    sparkKey: null,
  },
]

const STATUS_DOT = {
  good:    'bg-cortex-success',
  warn:    'bg-cortex-warning',
  bad:     'bg-cortex-danger',
  neutral: 'bg-cortex-muted',
}

function TrendChip({ delta, invertGood = false }) {
  if (delta === null || delta === undefined) return null
  const isPositive = delta > 0
  const isGood = invertGood ? !isPositive : isPositive

  if (delta === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-cortex-surface-raised text-cortex-muted">
      <Minus className="w-2.5 h-2.5" /> 0%
    </span>
  )

  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded ${
      isGood
        ? 'bg-cortex-success/10 text-cortex-success'
        : 'bg-cortex-danger/10 text-cortex-danger'
    }`}>
      {isPositive
        ? <TrendingUp className="w-2.5 h-2.5" />
        : <TrendingDown className="w-2.5 h-2.5" />
      }
      {Math.abs(delta)}%
    </span>
  )
}

export default function KPIStrip({ days = 30 }) {
  const { data: kpiData, isLoading } = useQuery({
    queryKey: ['kpi-summary', days],
    queryFn: () => getKPISummary(days),
    refetchInterval: 60000,
  })

  const { data: trendsData } = useQuery({
    queryKey: ['trends', { days }],
    queryFn: () => getTrends({ days }),
  })

  const sparkData = (trendsData?.current || []).map(d => ({
    v: parseInt(d.total_tickets) || 0,
  }))

  if (isLoading) {
    return (
      /* NEW: KPI strip loading skeleton */
      <div data-new="true" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_DEFS.map(k => (
          <div key={k.key} className="card h-24 animate-pulse bg-cortex-bg" />
        ))}
      </div>
    )
  }

  const curr = kpiData?.current || {}
  const deltas = kpiData?.deltas || {}

  return (
    /* NEW: KPI strip — 6 real-data metric cards */
    <div data-new="true" className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-cortex-muted">Key Performance Indicators</h2>
        <NewBadge description="New section — 6 live KPIs with WoW trend chips and status indicators." />
      </div>
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
    >
      {KPI_DEFS.map(kpi => {
        const raw = curr[kpi.key]
        const value = parseFloat(raw)
        const status = kpi.status(isNaN(value) ? null : value)
        const delta = kpi.deltaKey ? deltas[kpi.deltaKey] : null

        // Invert "good" direction for metrics where lower is better
        const invertGood = ['escalation_rate_pct', 'neg_sentiment_pct', 'avg_resolution_hours'].includes(kpi.key)

        return (
          /* NEW: KPI card */
          <div
            key={kpi.key}
            data-new="true"
            className="card relative flex flex-col gap-1.5 p-4 hover:-translate-y-0.5 transition-transform"
          >
            {/* Status dot */}
            <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />

            {/* Label */}
            <p className="text-[10px] font-mono uppercase tracking-wider text-cortex-muted pr-4">
              {kpi.label}
            </p>

            {/* Sparkline (only for total tickets) */}
            {kpi.sparkKey && sparkData.length > 1 && (
              <div className="absolute top-3 right-6 w-12 h-5 opacity-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="rgb(94 163 255)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Value */}
            <p className="text-2xl font-display font-bold text-cortex-text leading-none">
              {kpi.format(raw != null ? parseFloat(raw) : null)}
            </p>

            {/* Trend chip */}
            <TrendChip delta={delta} invertGood={invertGood} />
          </div>
        )
      })}
    </div>
    </div>
  )
}
