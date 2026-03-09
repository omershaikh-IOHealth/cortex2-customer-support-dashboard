'use client'

/* NEW: QA Queue Table — combines flagged (pending) + reviewed tickets with status tabs */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getQAReviews, getFlaggedTickets } from '@/lib/api'
import { ClipboardList, Search } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'
import { formatDate, getPriorityColor, getSLAStatusColor } from '@/lib/utils'

const RESULT_LABEL = {
  pass:             'Passed',
  borderline:       'Borderline',
  coaching_required:'Coaching Req.',
  fail:             'Failed',
  critical_fail:    'Critical Fail',
}

const RESULT_COLOR = {
  pass:             'bg-cortex-success/15 text-cortex-success',
  borderline:       'bg-cortex-warning/15 text-cortex-warning',
  coaching_required:'bg-blue-400/15 text-blue-400',
  fail:             'bg-cortex-danger/15 text-cortex-danger',
  critical_fail:    'bg-cortex-danger/20 text-cortex-danger font-bold',
  pending:          'bg-cortex-muted/15 text-cortex-muted',
}

const TABS = [
  { key: 'all',            label: 'All' },
  { key: 'pending',        label: 'Pending' },
  { key: 'pass',           label: 'Passed' },
  { key: 'borderline',     label: 'Borderline' },
  { key: 'coaching_required', label: 'Coaching Req.' },
  { key: 'fail',           label: 'Failed' },
  { key: 'critical_fail',  label: 'Critical Fail' },
]

export default function QAQueueTable({ onOpenScorecard }) {
  /* NEW: QA Queue Table */
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['qa-reviews-queue'],
    queryFn: () => getQAReviews({ limit: 200 }),
    refetchInterval: 60_000,
  })

  const { data: flagged = [], isLoading: flaggedLoading } = useQuery({
    queryKey: ['qa-flagged'],
    queryFn: getFlaggedTickets,
    refetchInterval: 30_000,
  })

  const loading = reviewsLoading || flaggedLoading

  // Merge: flagged = pending (not yet reviewed), reviews = already reviewed
  // Avoid duplicating tickets that appear in both
  const reviewedTicketIds = useMemo(() => new Set(reviews.map(r => r.ticket_id)), [reviews])

  const rows = useMemo(() => {
    const pendingRows = flagged
      .filter(f => !reviewedTicketIds.has(f.id))
      .map(f => ({
        _key:       `pending-${f.id}`,
        ticket_id:  f.id,
        clickup_id: f.clickup_task_id,
        title:      f.title,
        customer:   f.created_by_name,
        agent_name: f.assigned_to_name || '—',
        agent_id:   f.assigned_to_id || null,
        module:     f.module || '—',
        priority:   f.priority,
        created_at: f.created_at,
        sla_pct:    f.sla_consumption_pct,
        sla_status: f.sla_status,
        qa_result:  'pending',
        qa_score:   null,
        review_id:  null,
        _raw:       f,
      }))

    const reviewedRows = reviews.map(r => ({
      _key:       `review-${r.id}`,
      ticket_id:  r.ticket_id,
      clickup_id: r.clickup_task_id,
      title:      r.ticket_title,
      customer:   r.customer_name,
      agent_name: r.agent_name || '—',
      agent_id:   r.agent_id,
      module:     r.ticket_module || '—',
      priority:   r.ticket_priority,
      created_at: r.reviewed_at,
      sla_pct:    r.sla_consumption_pct,
      sla_status: r.ticket_status,
      qa_result:  r.result,
      qa_score:   r.total_score,
      review_id:  r.id,
      _raw:       r,
    }))

    return [...pendingRows, ...reviewedRows]
  }, [flagged, reviews, reviewedTicketIds])

  // Tab counts
  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, pass: 0, borderline: 0, coaching_required: 0, fail: 0, critical_fail: 0 }
    rows.forEach(r => { if (c[r.qa_result] !== undefined) c[r.qa_result]++ })
    return c
  }, [rows])

  // Filter
  const filtered = useMemo(() => {
    let out = rows
    if (activeTab !== 'all') out = out.filter(r => r.qa_result === activeTab)
    if (search) {
      const q = search.toLowerCase()
      out = out.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.customer?.toLowerCase().includes(q) ||
        r.agent_name?.toLowerCase().includes(q) ||
        r.clickup_id?.toLowerCase().includes(q)
      )
    }
    return out
  }, [rows, activeTab, search])

  return (
    /* NEW: QA Queue Table */
    <div data-new="true" className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-cortex-accent" />
        <h2 className="font-display font-bold text-cortex-text">QA Queue</h2>
        <NewBadge description="New view — all pending and reviewed tickets in one unified queue." />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search by ticket, agent, customer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input w-full pl-9 text-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-cortex-surface rounded-xl border border-cortex-border w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-cortex-bg text-cortex-text shadow-sm'
                : 'text-cortex-muted hover:text-cortex-text'
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                tab.key === 'critical_fail'
                  ? 'bg-cortex-danger/20 text-cortex-danger'
                  : tab.key === 'pending'
                    ? 'bg-cortex-muted/20 text-cortex-muted'
                    : 'bg-cortex-accent/15 text-cortex-accent'
              }`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-cortex-bg animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-cortex-muted">
          <div className="w-12 h-12 rounded-2xl bg-cortex-surface-raised flex items-center justify-center mb-3">
            <ClipboardList className="w-6 h-6 opacity-40" />
          </div>
          <p className="font-medium text-cortex-text mb-1">No tickets found</p>
          <p className="text-sm">
            {search ? 'Try a different search term' : `No tickets in "${TABS.find(t => t.key === activeTab)?.label}" status`}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cortex-border">
                  <th className="table-header w-8">#</th>
                  <th className="table-header">Ticket</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Agent</th>
                  <th className="table-header">Module</th>
                  <th className="table-header">Priority</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">SLA %</th>
                  <th className="table-header">QA Status</th>
                  <th className="table-header">Score</th>
                  <th className="table-header rounded-tr-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cortex-border">
                {filtered.map((row, i) => (
                  <tr key={row._key} className="hover:bg-cortex-surface-raised transition-colors">
                    <td className="table-cell text-xs font-mono text-cortex-muted">{i + 1}</td>
                    <td className="table-cell max-w-[200px]">
                      <a
                        href={`/tickets/${row.ticket_id}`}
                        className="text-cortex-accent hover:underline text-xs font-mono block truncate"
                      >
                        {row.clickup_id || `#${row.ticket_id}`}
                      </a>
                      <p className="text-xs text-cortex-muted truncate">{row.title}</p>
                    </td>
                    <td className="table-cell text-xs text-cortex-muted max-w-[120px] truncate">
                      {row.customer || '—'}
                    </td>
                    <td className="table-cell text-xs text-cortex-text max-w-[120px] truncate">
                      {row.agent_name}
                    </td>
                    <td className="table-cell text-xs text-cortex-muted max-w-[100px] truncate">
                      {row.module}
                    </td>
                    <td className="table-cell">
                      {row.priority
                        ? <span className={`badge ${getPriorityColor(row.priority)}`}>{row.priority}</span>
                        : <span className="text-cortex-muted text-xs">—</span>
                      }
                    </td>
                    <td className="table-cell text-xs text-cortex-muted font-mono whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="table-cell">
                      {row.sla_pct != null
                        ? <span className={`badge ${getSLAStatusColor(row.sla_status)}`}>{Math.round(row.sla_pct)}%</span>
                        : <span className="text-cortex-muted text-xs">—</span>
                      }
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${RESULT_COLOR[row.qa_result] || 'bg-cortex-muted/15 text-cortex-muted'}`}>
                        {RESULT_LABEL[row.qa_result] || row.qa_result || '—'}
                      </span>
                    </td>
                    <td className="table-cell">
                      {row.qa_score != null
                        ? <span className={`font-mono text-sm font-bold ${
                            row.qa_score >= 85 ? 'text-cortex-success'
                            : row.qa_score >= 70 ? 'text-cortex-warning'
                            : 'text-cortex-danger'
                          }`}>{Math.round(row.qa_score)}</span>
                        : <span className="text-cortex-muted text-xs">—</span>
                      }
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => onOpenScorecard?.(row)}
                        className="text-xs font-medium text-cortex-accent hover:underline whitespace-nowrap"
                      >
                        {row.qa_result === 'pending' ? 'Score →' : 'View →'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
