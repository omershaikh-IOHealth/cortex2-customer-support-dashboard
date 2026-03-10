'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone, RefreshCw, Search, Filter } from 'lucide-react'
import { getCalls, syncMyCalls } from '@/lib/api'
import EmptyState from '@/components/ui/EmptyState'

function fmtSecs(secs) {
  if (!secs) return '0:00'
  const m = Math.floor(secs / 60)
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function MyCallsPage() {
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [dirFilter, setDirFilter] = useState('')
  const [dispFilter, setDispFilter] = useState('')
  const [custSearch, setCustSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const r = await syncMyCalls()
      setSyncMsg({ ok: true, text: `Synced ${r.synced} · ${r.skipped} already existed` })
      qc.invalidateQueries({ queryKey: ['my-calls-full'] })
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  const { data: callsRaw = [], isLoading } = useQuery({
    queryKey: ['my-calls-full'],
    queryFn: () => getCalls({ limit: 200 }),
    refetchInterval: 30000,
  })

  const calls = callsRaw.filter(c => {
    if (dirFilter && c.direction !== dirFilter) return false
    if (dispFilter === 'fcr' && !c.fcr) return false
    if (dispFilter === 'missed' && !(c.hangup_cause === 'missed' || !c.duration_secs)) return false
    if (dateFrom) {
      const d = new Date(c.started_at)
      if (d < new Date(dateFrom + 'T00:00:00')) return false
    }
    if (dateTo) {
      const d = new Date(c.started_at)
      if (d > new Date(dateTo + 'T23:59:59')) return false
    }
    if (custSearch.trim()) {
      const s = custSearch.toLowerCase()
      return (c.customer_name || c.customer_number || '').toLowerCase().includes(s)
    }
    return true
  })

  const totalDuration = calls.reduce((s, c) => s + (c.duration_secs || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Call History</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">My Calls</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && (
            <p className={`text-xs font-mono ${syncMsg.ok ? 'text-cortex-success' : 'text-cortex-danger'}`}>
              {syncMsg.text}
            </p>
          )}
          <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-2 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync ZIWO'}
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: calls.length },
          { label: 'Inbound', value: calls.filter(c => c.direction === 'inbound').length, color: 'text-cortex-success' },
          { label: 'Outbound', value: calls.filter(c => c.direction === 'outbound').length, color: 'text-cortex-warning' },
          { label: 'Total Duration', value: fmtSecs(totalDuration), mono: true },
        ].map(({ label, value, color, mono }) => (
          <div key={label} className="card py-3 text-center">
            <p className={`text-2xl font-display font-bold ${color || 'text-cortex-text'} ${mono ? 'font-mono' : ''}`}>{value}</p>
            <p className="text-[10px] uppercase tracking-wide text-cortex-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-cortex-muted flex-shrink-0" />
          <select
            value={dirFilter}
            onChange={e => setDirFilter(e.target.value)}
            className="input text-xs py-1.5 w-36"
          >
            <option value="">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <select
            value={dispFilter}
            onChange={e => setDispFilter(e.target.value)}
            className="input text-xs py-1.5 w-36"
          >
            <option value="">All Types</option>
            <option value="missed">Missed</option>
            <option value="fcr">FCR</option>
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-cortex-muted">From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-xs py-1.5 w-36" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-cortex-muted">To</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-xs py-1.5 w-36" />
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cortex-muted pointer-events-none" />
            <input
              type="text"
              value={custSearch}
              onChange={e => setCustSearch(e.target.value)}
              placeholder="Search customer…"
              className="input text-xs py-1.5 pl-8 w-full"
            />
          </div>
          {(dirFilter || dispFilter || dateFrom || dateTo || custSearch) && (
            <button
              onClick={() => { setDirFilter(''); setDispFilter(''); setDateFrom(''); setDateTo(''); setCustSearch('') }}
              className="text-xs text-cortex-muted hover:text-cortex-danger transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Calls table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-cortex-bg animate-pulse" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Phone} title="No calls found" message="No calls match your current filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cortex-border">
                  <th className="table-header">Direction</th>
                  <th className="table-header">Number</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header">Disposition</th>
                  <th className="table-header">FCR</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cortex-border">
                {calls.map(c => {
                  const isMissed = c.hangup_cause === 'missed' || c.hangup_cause === 'caller_cancel' || (!c.duration_secs && c.direction === 'inbound')
                  const d = c.started_at ? new Date(c.started_at) : null
                  return (
                    <tr key={c.id} className={`hover:bg-cortex-surface-raised transition-colors ${isMissed ? 'bg-cortex-danger/5' : ''}`}>
                      <td className="table-cell">
                        <span className={`badge text-xs ${
                          isMissed
                            ? 'text-cortex-danger bg-cortex-danger/10'
                            : c.direction === 'inbound'
                              ? 'text-cortex-success bg-cortex-success/10'
                              : 'text-cortex-warning bg-cortex-warning/10'
                        }`}>
                          {c.direction === 'inbound' ? '↓' : '↑'} {isMissed ? 'missed' : c.direction}
                        </span>
                      </td>
                      <td className="table-cell font-mono text-xs text-cortex-muted">{c.customer_number || '—'}</td>
                      <td className="table-cell text-xs text-cortex-text max-w-[140px] truncate">{c.customer_name || '—'}</td>
                      <td className="table-cell font-mono text-sm">{fmtSecs(c.duration_secs)}</td>
                      <td className="table-cell text-xs text-cortex-muted">{c.disposition_name || '—'}</td>
                      <td className="table-cell text-center">
                        {c.fcr ? <span className="badge bg-cortex-success/10 text-cortex-success text-[10px]">FCR</span> : null}
                      </td>
                      <td className="table-cell text-xs text-cortex-muted font-mono">{d ? d.toLocaleDateString('en-GB') : '—'}</td>
                      <td className="table-cell text-xs text-cortex-muted font-mono">
                        {d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
