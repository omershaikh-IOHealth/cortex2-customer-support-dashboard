'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shuffle, Download, RefreshCw, FlaskConical, Flag, X, ClipboardList, Users } from 'lucide-react'
import { getQASample, getFlaggedTickets, unflagTicket } from '@/lib/api'
import NewBadge from '@/components/ui/NewBadge'
import { formatDate, getPriorityColor, getSLAStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

/* NEW: QA enhancement components */
import QAMetricsStrip    from '@/components/qa/QAMetricsStrip'
import QAQueueTable      from '@/components/qa/QAQueueTable'
import QAScorecardPanel  from '@/components/qa/QAScorecardPanel'
import AgentPerformanceView from '@/components/qa/AgentPerformanceView'

export default function QAPage() {
  // ── Top-level view toggle ─────────────────────────────────────────────────
  const [view, setView] = useState('queue') // 'queue' | 'performance'

  // ── Scorecard panel ───────────────────────────────────────────────────────
  const [scorecardRow, setScorecardRow] = useState(null)

  // ── Random sample state (kept as tertiary tab inside Queue) ───────────────
  const [sampleTab, setSampleTab] = useState('unified') // 'unified' | 'sample' | 'flagged'
  const [count, setCount] = useState(10)
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tickets, setTickets] = useState([])
  const [sampleLoading, setSampleLoading] = useState(false)
  const [sampleError, setSampleError] = useState(null)
  const [lastPulled, setLastPulled] = useState(null)

  // ── Flagged tab state ─────────────────────────────────────────────────────
  const queryClient = useQueryClient()
  const { data: flaggedTickets = [], isLoading: flaggedLoading } = useQuery({
    queryKey: ['qa-flagged'],
    queryFn: getFlaggedTickets,
    enabled: sampleTab === 'flagged',
  })

  const pullSample = async () => {
    setSampleLoading(true)
    setSampleError(null)
    try {
      const params = { count }
      if (priority) params.priority = priority
      if (status)   params.status   = status
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo
      const data = await getQASample(params)
      setTickets(data)
      setLastPulled(new Date())
    } catch {
      setSampleError('Failed to pull sample. Please try again.')
    } finally {
      setSampleLoading(false)
    }
  }

  const exportCSV = () => {
    if (!tickets.length) return
    const headers = ['Ticket ID', 'Title', 'Priority', 'Status', 'SLA %', 'Module', 'Request Type', 'Reporter', 'Created', 'Resolved']
    const rows = tickets.map(t => [
      t.clickup_task_id || t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.priority, t.status, t.sla_consumption_pct,
      t.module || '', t.request_type || '', t.created_by_name || '',
      formatDate(t.created_at), formatDate(t.resolved_at),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `qa-sample-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUnflag = async (id) => {
    try {
      await unflagTicket(id)
      queryClient.invalidateQueries({ queryKey: ['qa-flagged'] })
      toast.success('Flag removed')
    } catch (e) {
      toast.error(e.message || 'Failed to remove flag')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Quality Assurance</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">QA Sampling</h1>
        </div>
        <div className="flex items-center gap-3">
          {sampleTab === 'sample' && tickets.length > 0 && view === 'queue' && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          {/* NEW: View toggle */}
          <div className="flex items-center gap-1 p-1 bg-cortex-surface rounded-xl border border-cortex-border">
            <button
              onClick={() => setView('queue')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'queue'
                  ? 'bg-cortex-bg text-cortex-text shadow-sm'
                  : 'text-cortex-muted hover:text-cortex-text'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              QA Queue
            </button>
            <button
              onClick={() => setView('performance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'performance'
                  ? 'bg-cortex-bg text-cortex-text shadow-sm'
                  : 'text-cortex-muted hover:text-cortex-text'
              }`}
            >
              <Users className="w-4 h-4" />
              Agent Performance
              <NewBadge description="New view — per-agent QA scores and pass rate analysis." />
            </button>
          </div>
        </div>
      </div>

      {/* NEW: QA Metrics Strip — always visible */}
      {/* NEW: QAMetricsStrip sourced from main.qa_scores */}
      <QAMetricsStrip />

      {/* ── QA Queue view ── */}
      {view === 'queue' && (
        <>
          {/* Sub-tabs: Unified Queue | Random Sample | Flagged */}
          <div className="flex items-center gap-1 p-1 bg-cortex-surface rounded-xl border border-cortex-border w-fit">
            <button
              onClick={() => setSampleTab('unified')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sampleTab === 'unified'
                  ? 'bg-cortex-bg text-cortex-text shadow-sm'
                  : 'text-cortex-muted hover:text-cortex-text'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              All Tickets
              <NewBadge description="New — unified queue of flagged + reviewed tickets." />
            </button>
            <button
              onClick={() => setSampleTab('sample')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sampleTab === 'sample'
                  ? 'bg-cortex-bg text-cortex-text shadow-sm'
                  : 'text-cortex-muted hover:text-cortex-text'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              Random Sample
            </button>
            <button
              onClick={() => setSampleTab('flagged')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sampleTab === 'flagged'
                  ? 'bg-cortex-bg text-cortex-text shadow-sm'
                  : 'text-cortex-muted hover:text-cortex-text'
              }`}
            >
              <Flag className="w-4 h-4" />
              Flagged
              {flaggedTickets.length > 0 && (
                <span className="text-[10px] bg-cortex-danger/15 text-cortex-danger px-1.5 py-0.5 rounded font-mono">
                  {flaggedTickets.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Unified queue tab ── */}
          {/* NEW: QA Queue unified table */}
          {sampleTab === 'unified' && (
            <QAQueueTable onOpenScorecard={row => setScorecardRow(row)} />
          )}

          {/* ── Random sample tab ── */}
          {sampleTab === 'sample' && (
            <>
              <div className="card">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-cortex-muted mb-1.5">Sample Size</label>
                    <input type="number" min={5} max={50} value={count} onChange={e => setCount(parseInt(e.target.value) || 10)} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-cortex-muted mb-1.5">Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)} className="input w-full">
                      <option value="">All</option>
                      <option value="P1">P1 — Critical</option>
                      <option value="P2">P2 — High</option>
                      <option value="P3">P3 — Medium</option>
                      <option value="P4">P4 — Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-cortex-muted mb-1.5">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} className="input w-full">
                      <option value="">All</option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="complete">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-cortex-muted mb-1.5">From Date</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-cortex-muted mb-1.5">To Date</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-full" />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-4 border-t border-cortex-border">
                  <button onClick={pullSample} disabled={sampleLoading} className="btn-primary flex items-center gap-2">
                    {sampleLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                    {sampleLoading ? 'Pulling Sample…' : 'Pull Random Sample'}
                  </button>
                  {lastPulled && (
                    <span className="text-xs text-cortex-muted font-mono">Pulled at {lastPulled.toLocaleTimeString()}</span>
                  )}
                </div>
              </div>

              {sampleError && (
                <p className="text-cortex-danger text-sm bg-cortex-danger/10 border border-cortex-danger/20 rounded-xl px-4 py-3">{sampleError}</p>
              )}

              {tickets.length > 0 && (
                <div className="card p-0 overflow-hidden">
                  <div className="px-5 py-3 border-b border-cortex-border bg-cortex-bg flex items-center justify-between">
                    <span className="text-sm font-semibold text-cortex-text">{tickets.length} tickets sampled</span>
                    <button onClick={pullSample} className="flex items-center gap-1.5 text-xs text-cortex-accent hover:underline">
                      <RefreshCw className="w-3 h-3" /> Re-sample
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-cortex-border">
                          <th className="table-header">Ticket ID</th>
                          <th className="table-header">Title</th>
                          <th className="table-header">Priority</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">SLA %</th>
                          <th className="table-header">Module</th>
                          <th className="table-header">Reporter</th>
                          <th className="table-header rounded-tr-xl">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cortex-border">
                        {tickets.map(t => (
                          <tr key={t.id} className="hover:bg-cortex-surface-raised transition-colors">
                            <td className="table-cell"><span className="font-mono text-xs text-cortex-muted">{t.clickup_task_id || `#${t.id}`}</span></td>
                            <td className="table-cell max-w-xs">
                              <a href={`/tickets/${t.id}`} className="text-cortex-accent hover:underline text-sm line-clamp-1">{t.title}</a>
                            </td>
                            <td className="table-cell"><span className={`badge ${getPriorityColor(t.priority)}`}>{t.priority}</span></td>
                            <td className="table-cell"><span className="text-xs text-cortex-muted capitalize">{t.status}</span></td>
                            <td className="table-cell"><span className={`badge ${getSLAStatusColor(t.sla_status)}`}>{t.sla_consumption_pct ? `${Math.round(t.sla_consumption_pct)}%` : '—'}</span></td>
                            <td className="table-cell text-xs text-cortex-muted">{t.module || '—'}</td>
                            <td className="table-cell text-xs text-cortex-muted">{t.created_by_name || '—'}</td>
                            <td className="table-cell text-xs text-cortex-muted">{formatDate(t.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!sampleLoading && tickets.length === 0 && !sampleError && (
                <div className="card flex flex-col items-center justify-center py-20 text-cortex-muted">
                  <div className="w-14 h-14 rounded-2xl bg-cortex-surface-raised flex items-center justify-center mb-4">
                    <FlaskConical className="w-7 h-7 opacity-40" />
                  </div>
                  <p className="font-medium text-cortex-text mb-1">No sample pulled yet</p>
                  <p className="text-sm">Configure filters above and click <strong className="text-cortex-text font-semibold">Pull Random Sample</strong></p>
                </div>
              )}
            </>
          )}

          {/* ── Flagged tab ── */}
          {sampleTab === 'flagged' && (
            <>
              {flaggedLoading ? (
                <div className="card"><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-cortex-bg animate-pulse rounded-xl" />)}</div></div>
              ) : flaggedTickets.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-20 text-cortex-muted">
                  <div className="w-14 h-14 rounded-2xl bg-cortex-surface-raised flex items-center justify-center mb-4">
                    <Flag className="w-7 h-7 opacity-40" />
                  </div>
                  <p className="font-medium text-cortex-text mb-1">No flagged tickets</p>
                  <p className="text-sm">Flag tickets from the ticket detail page for QA review</p>
                </div>
              ) : (
                <div className="card p-0 overflow-hidden">
                  <div className="px-5 py-3 border-b border-cortex-border bg-cortex-bg">
                    <span className="text-sm font-semibold text-cortex-text">{flaggedTickets.length} flagged ticket{flaggedTickets.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-cortex-border">
                          <th className="table-header">Ticket ID</th>
                          <th className="table-header">Title</th>
                          <th className="table-header">Priority</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Flag Reason</th>
                          <th className="table-header">Flagged By</th>
                          <th className="table-header">Flagged At</th>
                          <th className="table-header rounded-tr-xl">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cortex-border">
                        {flaggedTickets.map(t => (
                          <tr key={t.id} className="hover:bg-cortex-surface-raised transition-colors">
                            <td className="table-cell"><span className="font-mono text-xs text-cortex-muted">{t.clickup_task_id || `#${t.id}`}</span></td>
                            <td className="table-cell max-w-xs">
                              <a href={`/tickets/${t.id}`} className="text-cortex-accent hover:underline text-sm line-clamp-1">{t.title}</a>
                            </td>
                            <td className="table-cell"><span className={`badge ${getPriorityColor(t.priority)}`}>{t.priority}</span></td>
                            <td className="table-cell"><span className="text-xs text-cortex-muted capitalize">{t.status}</span></td>
                            <td className="table-cell max-w-xs"><span className="text-xs text-cortex-text line-clamp-2">{t.qa_flag_reason || '—'}</span></td>
                            <td className="table-cell">
                              <div className="text-xs">
                                <p className="font-medium text-cortex-text">{t.qa_flagged_by_name || '—'}</p>
                                <p className="text-cortex-muted">{t.qa_flagged_by_email?.split('@')[0]}</p>
                              </div>
                            </td>
                            <td className="table-cell text-xs text-cortex-muted font-mono">{formatDate(t.qa_flagged_at)}</td>
                            <td className="table-cell">
                              <button
                                onClick={() => handleUnflag(t.id)}
                                className="flex items-center gap-1 text-xs text-cortex-muted hover:text-cortex-danger transition-colors"
                                title="Remove flag"
                              >
                                <X className="w-3.5 h-3.5" /> Unflag
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Agent Performance view ── */}
      {/* NEW: Agent Performance View */}
      {view === 'performance' && (
        <AgentPerformanceView />
      )}

      {/* NEW: QA Scorecard Slide Panel */}
      {scorecardRow && (
        <QAScorecardPanel
          row={scorecardRow}
          onClose={() => setScorecardRow(null)}
        />
      )}
    </div>
  )
}
