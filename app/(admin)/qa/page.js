'use client'

import { useState } from 'react'
import { Shuffle, Download, RefreshCw, FlaskConical } from 'lucide-react'
import { getQASample } from '@/lib/api'
import { formatDate, getPriorityColor, getSLAStatusColor } from '@/lib/utils'

export default function QAPage() {
  const [count, setCount] = useState(10)
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastPulled, setLastPulled] = useState(null)

  const pullSample = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { count }
      if (priority) params.priority = priority
      if (status) params.status = status
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const data = await getQASample(params)
      setTickets(data)
      setLastPulled(new Date())
    } catch (e) {
      setError('Failed to pull sample. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    if (!tickets.length) return
    const headers = ['Ticket ID', 'Title', 'Priority', 'Status', 'SLA %', 'Module', 'Request Type', 'Reporter', 'Created', 'Resolved']
    const rows = tickets.map(t => [
      t.clickup_task_id || t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.priority,
      t.status,
      t.sla_consumption_pct,
      t.module || '',
      t.request_type || '',
      t.created_by_name || '',
      formatDate(t.created_at),
      formatDate(t.resolved_at),
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qa-sample-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Quality Assurance</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">QA Sampling</h1>
        </div>
        {tickets.length > 0 && (
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-cortex-muted mb-1.5">Sample Size</label>
            <input
              type="number"
              min={5}
              max={50}
              value={count}
              onChange={e => setCount(parseInt(e.target.value) || 10)}
              className="input w-full"
            />
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
          <button
            onClick={pullSample}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Shuffle className="w-4 h-4" />}
            {loading ? 'Pulling Sample…' : 'Pull Random Sample'}
          </button>
          {lastPulled && (
            <span className="text-xs text-cortex-muted font-mono">
              Pulled at {lastPulled.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-cortex-danger text-sm bg-cortex-danger/10 border border-cortex-danger/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Results table */}
      {tickets.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-cortex-border bg-cortex-bg flex items-center justify-between">
            <span className="text-sm font-semibold text-cortex-text">
              {tickets.length} tickets sampled
            </span>
            <button
              onClick={pullSample}
              className="flex items-center gap-1.5 text-xs text-cortex-accent hover:underline"
            >
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
                    <td className="table-cell">
                      <span className="font-mono text-xs text-cortex-muted">{t.clickup_task_id || `#${t.id}`}</span>
                    </td>
                    <td className="table-cell max-w-xs">
                      <a href={`/tickets/${t.id}`} className="text-cortex-accent hover:underline text-sm line-clamp-1">
                        {t.title}
                      </a>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-cortex-muted capitalize">{t.status}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getSLAStatusColor(t.sla_status)}`}>
                        {t.sla_consumption_pct ? `${Math.round(t.sla_consumption_pct)}%` : '—'}
                      </span>
                    </td>
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

      {/* Empty state */}
      {!loading && tickets.length === 0 && !error && (
        <div className="card flex flex-col items-center justify-center py-20 text-cortex-muted">
          <div className="w-14 h-14 rounded-2xl bg-cortex-surface-raised flex items-center justify-center mb-4">
            <FlaskConical className="w-7 h-7 opacity-40" />
          </div>
          <p className="font-medium text-cortex-text mb-1">No sample pulled yet</p>
          <p className="text-sm">Configure filters above and click <strong className="text-cortex-text font-semibold">Pull Random Sample</strong></p>
        </div>
      )}
    </div>
  )
}
