'use client'

/* NEW: QA Metrics Strip — 8 KPI cards sourced from qa_scores + flagged tickets */

import { useQuery } from '@tanstack/react-query'
import { getQAReviews, getFlaggedTickets } from '@/lib/api'
import { ClipboardCheck, Star, CheckCircle, AlertOctagon, Clock, BookOpen, Users, TrendingUp } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'

function MetricCard({ icon: Icon, label, value, sub, color = 'text-cortex-accent', loading }) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-cortex-bg`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div>
        {loading ? (
          <div className="h-7 w-16 bg-cortex-bg animate-pulse rounded-md" />
        ) : (
          <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
        )}
        <p className="text-xs font-semibold text-cortex-muted mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-cortex-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function QAMetricsStrip({ days = 30 }) {
  /* NEW: QA metrics strip */
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['qa-reviews-strip', days],
    queryFn: () => getQAReviews({ limit: 200 }),
    refetchInterval: 60_000,
  })

  const { data: flagged = [], isLoading: flaggedLoading } = useQuery({
    queryKey: ['qa-flagged'],
    queryFn: getFlaggedTickets,
    refetchInterval: 30_000,
  })

  const loading = reviewsLoading || flaggedLoading

  // Derived stats
  const total       = reviews.length
  const avgScore    = total > 0
    ? (reviews.reduce((s, r) => s + (parseFloat(r.total_score) || 0), 0) / total).toFixed(1)
    : '—'
  const passCount   = reviews.filter(r => r.result === 'pass').length
  const passRate    = total > 0 ? Math.round((passCount / total) * 100) : 0
  const critFail    = reviews.filter(r => r.result === 'critical_fail').length
  const coaching    = reviews.filter(r => r.result === 'coaching_required').length
  const withCoach   = reviews.filter(r => r.coaching_notes && r.coaching_notes.trim()).length
  const improvement = reviews.filter(r => r.improvement_themes && r.improvement_themes.length > 0).length
  const improvePct  = total > 0 ? Math.round((improvement / total) * 100) : 0

  const cards = [
    {
      icon: ClipboardCheck,
      label: 'Sampled This Period',
      value: loading ? '—' : total,
      color: 'text-cortex-accent',
    },
    {
      icon: Star,
      label: 'Avg QA Score',
      value: loading ? '—' : avgScore !== '—' ? `${avgScore}` : '—',
      sub: 'out of 100',
      color: avgScore >= 85 ? 'text-cortex-success' : avgScore >= 70 ? 'text-cortex-warning' : 'text-cortex-danger',
    },
    {
      icon: CheckCircle,
      label: 'Pass Rate',
      value: loading ? '—' : `${passRate}%`,
      sub: `${passCount} of ${total} passed`,
      color: passRate >= 80 ? 'text-cortex-success' : passRate >= 60 ? 'text-cortex-warning' : 'text-cortex-danger',
    },
    {
      icon: AlertOctagon,
      label: 'Critical Failures',
      value: loading ? '—' : critFail,
      color: critFail > 0 ? 'text-cortex-danger' : 'text-cortex-success',
    },
    {
      icon: Clock,
      label: 'Pending Review',
      value: loading ? '—' : flagged.length,
      sub: 'flagged tickets awaiting QA',
      color: flagged.length > 5 ? 'text-cortex-warning' : 'text-cortex-muted',
    },
    {
      icon: BookOpen,
      label: 'Coaching Required',
      value: loading ? '—' : coaching,
      color: coaching > 3 ? 'text-cortex-warning' : 'text-cortex-muted',
    },
    {
      icon: Users,
      label: 'Coaching Assigned',
      value: loading ? '—' : withCoach,
      sub: 'reviews with notes',
      color: 'text-blue-400',
    },
    {
      icon: TrendingUp,
      label: 'Improvement Rate',
      value: loading ? '—' : `${improvePct}%`,
      sub: 'reviews with themes',
      color: improvePct > 50 ? 'text-cortex-success' : 'text-cortex-muted',
    },
  ]

  return (
    /* NEW: QA Metrics Strip */
    <div data-new="true" className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display font-bold text-cortex-text text-sm uppercase tracking-widest text-cortex-muted">
          QA Performance Overview
        </h2>
        <NewBadge description="New section — QA performance KPIs sourced from reviewed tickets and flagged queue." />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {cards.map(c => (
          <MetricCard key={c.label} {...c} loading={loading} />
        ))}
      </div>
    </div>
  )
}
