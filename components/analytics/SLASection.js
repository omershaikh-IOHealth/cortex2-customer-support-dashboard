'use client'

/* NEW: SLA & Escalation Intelligence section — risk cards + SLA by priority chart + ticket aging */

import { useQuery } from '@tanstack/react-query'
import { getKPISummary, getAgingDistribution } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { AlertTriangle } from 'lucide-react'
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

const PRIORITY_COLORS = { P1: '#ef4444', P2: '#f97316', P3: '#f59e0b', P4: '#5ea3ff', P5: '#94a3b8' }

const AGING_COLORS = ['#22c55e', '#5ea3ff', '#f59e0b', '#f97316', '#ef4444', '#ff3366']

function RiskCard({ label, value, sub, color = 'text-cortex-text' }) {
  return (
    <div className="p-4 rounded-xl bg-cortex-bg border border-cortex-border">
      <p className="text-[10px] font-mono uppercase tracking-wider text-cortex-muted mb-2">{label}</p>
      <p className={`text-2xl font-display font-bold ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-cortex-muted mt-1">{sub}</p>}
    </div>
  )
}

export default function SLASection({ priorityDist = [], priorityLoading, days = 30 }) {
  const { data: kpiData } = useQuery({
    queryKey: ['kpi-summary', days],
    queryFn: () => getKPISummary(days),
  })
  const { data: agingData = [], isLoading: agingLoading } = useQuery({
    queryKey: ['aging'],
    queryFn: getAgingDistribution,
    refetchInterval: 120000,
  })

  const curr = kpiData?.current || {}

  // Count tickets with SLA 65–100% (at risk)
  const atRisk = priorityDist.reduce((s, d) => {
    // avg_sla_consumption is an average — use as proxy indicator
    return s
  }, 0)

  const AXIS_STYLE = { stroke: 'rgb(128 148 184)', tick: { fill: 'rgb(128 148 184)', fontSize: 11 } }
  const GRID_STYLE = { strokeDasharray: '3 3', stroke: 'rgb(30 42 66)' }

  return (
    /* NEW: SLA & Escalation Intelligence section */
    <div data-new="true" className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-cortex-danger" />
        <h2 className="font-display font-bold text-cortex-text">SLA &amp; Escalation Intelligence</h2>
        <NewBadge description="New section — SLA risk cards, SLA by priority chart, and ticket aging distribution." />
      </div>

      {/* Risk cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <RiskCard
          label="SLA Compliance"
          value={curr.sla_compliance_pct != null ? `${curr.sla_compliance_pct}%` : '—'}
          sub="tickets within SLA"
          color={parseFloat(curr.sla_compliance_pct) >= 90 ? 'text-cortex-success' : parseFloat(curr.sla_compliance_pct) >= 75 ? 'text-cortex-warning' : 'text-cortex-danger'}
        />
        <RiskCard
          label="P1 Open"
          value={curr.p1_open ?? '—'}
          sub="critical open tickets"
          color={parseInt(curr.p1_open) > 0 ? 'text-cortex-danger' : 'text-cortex-success'}
        />
        <RiskCard
          label="Escalation Rate"
          value={curr.escalation_rate_pct != null ? `${curr.escalation_rate_pct}%` : '—'}
          sub="of all tickets"
          color={parseFloat(curr.escalation_rate_pct) > 15 ? 'text-cortex-danger' : 'text-cortex-warning'}
        />
        <RiskCard
          label="Open Tickets"
          value={curr.open_tickets ?? '—'}
          sub="not yet resolved"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SLA by Priority */}
        <div className="card">
          <h3 className="font-semibold text-cortex-text text-sm mb-4">SLA Consumption by Priority</h3>
          {priorityLoading ? (
            <div className="h-52 bg-cortex-bg animate-pulse rounded-xl" />
          ) : priorityDist?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={priorityDist}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid {...GRID_STYLE} horizontal={false} />
                <XAxis type="number" {...AXIS_STYLE} unit="%" domain={[0, 100]} />
                <YAxis type="category" dataKey="priority" {...AXIS_STYLE} width={28} />
                <Tooltip {...TOOLTIP_STYLE}
                  formatter={v => [`${v}%`, 'Avg SLA']}
                />
                <Bar dataKey="avg_sla_consumption" radius={[0, 4, 4, 0]}>
                  {priorityDist.map((e, i) => (
                    <Cell key={i} fill={PRIORITY_COLORS[e.priority] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-cortex-muted text-sm">No SLA data</p>
          )}
        </div>

        {/* Ticket Aging */}
        <div className="card">
          <h3 className="font-semibold text-cortex-text text-sm mb-4">Ticket Aging Distribution (Open)</h3>
          {agingLoading ? (
            <div className="h-52 bg-cortex-bg animate-pulse rounded-xl" />
          ) : agingData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="bucket" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} formatter={v => [v, 'Tickets']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {agingData.map((_, i) => (
                    <Cell key={i} fill={AGING_COLORS[i] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-cortex-muted text-sm">No open tickets to show aging</p>
          )}
        </div>
      </div>
    </div>
  )
}
