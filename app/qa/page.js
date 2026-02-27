'use client'

import { useState } from 'react'
import { Shuffle, Download, RefreshCw } from 'lucide-react'
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
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-cortex-text">QA Sampling</h1>
          <p className="text-cortex-muted mt-1">Pull a random set of tickets for manual quality review</p>
        </div>
        {tickets.length > 0 && (
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="card mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-xs text-cortex-muted mb-1 font-mono">Sample Size</label>
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
            <label className="block text-xs text-cortex-muted mb-1 font-mono">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="input w-full">
              <option value="">All</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="P4">P4</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-cortex-muted mb-1 font-mono">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input w-full">
              <option value="">All</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-cortex-muted mb-1 font-mono">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs text-cortex-muted mb-1 font-mono">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-full" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={pullSample}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Shuffle className="w-4 h-4" />}
            {loading ? 'Pulling Sample...' : 'Pull Random Sample'}
          </button>
          {lastPulled && (
            <span className="text-xs text-cortex-muted font-mono">
              Last pulled: {lastPulled.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-cortex-danger text-sm mb-4">{error}</p>}

      {/* Results */}
      {tickets.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-cortex-border bg-cortex-bg flex items-center justify-between">
            <span className="text-sm font-medium text-cortex-text">{tickets.length} tickets sampled</span>
            <button
              onClick={pullSample}
              className="text-xs text-cortex-accent hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Re-sample
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Ticket ID</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Priority</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">SLA %</th>
                  <th className="table-header">Module</th>
                  <th className="table-header">Reporter</th>
                  <th className="table-header">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cortex-border">
                {tickets.map(t => (
                  <tr key={t.id} className="hover:bg-cortex-bg/50 transition-colors">
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
                      <span className="text-xs text-cortex-muted">{t.status}</span>
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

      {!loading && tickets.length === 0 && !error && (
        <div className="card flex flex-col items-center justify-center py-16 text-cortex-muted">
          <Shuffle className="w-12 h-12 mb-4 opacity-30" />
          <p>Configure your filters above and click <strong className="text-cortex-text">Pull Random Sample</strong></p>
        </div>
      )}
    </div>
  )
}
