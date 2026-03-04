'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getLogs, syncCallLogs, getCalls, getUsers } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import {
  Activity, CheckCircle, XCircle, AlertCircle, RefreshCw, Phone, Ticket, PhoneIncoming, PhoneOutgoing
} from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'
import Link from 'next/link'

function StatusBadge({ status }) {
  const isOk  = status === 'success'
  const isErr = status === 'error' || status === 'failed'
  return (
    <div className="flex items-center gap-1.5">
      {isOk  && <CheckCircle  className="w-3.5 h-3.5 text-cortex-success flex-shrink-0" />}
      {isErr && <XCircle      className="w-3.5 h-3.5 text-cortex-danger  flex-shrink-0" />}
      {!isOk && !isErr && <AlertCircle className="w-3.5 h-3.5 text-cortex-warning flex-shrink-0" />}
      <span className={`badge ${
        isOk  ? 'bg-cortex-success/10 text-cortex-success' :
        isErr ? 'bg-cortex-danger/10  text-cortex-danger'  :
                'bg-cortex-warning/10 text-cortex-warning'
      }`}>
        {status}
      </span>
    </div>
  )
}

function fmtSecs(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60), s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function LogsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('workflows')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [callFilters, setCallFilters] = useState({ agent_id: '', has_ticket: '', direction: '' })

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => getLogs(100),
    refetchInterval: 30000,
    enabled: tab === 'workflows',
  })

  const { data: callLogs = [], isLoading: callsLoading } = useQuery({
    queryKey: ['admin-calls', callFilters],
    queryFn: () => getCalls({ limit: 200, ...callFilters }),
    refetchInterval: 30000,
    enabled: tab === 'calls',
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 300000,
    enabled: tab === 'calls',
  })
  const agents = users.filter(u => u.is_active)

  async function handleSyncCallLogs() {
    setSyncing(true); setSyncResult(null)
    try {
      const result = await syncCallLogs()
      setSyncResult({ ok: true, message: `Synced ${result.synced} calls · ${result.skipped} already existed` })
      qc.invalidateQueries({ queryKey: ['admin-calls'] })
    } catch (e) {
      setSyncResult({ ok: false, message: e.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Diagnostics</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">System Logs</h1>
        </div>
        <div className="flex items-center gap-3">
          {syncResult && (
            <p className={`text-xs font-mono ${syncResult.ok ? 'text-cortex-success' : 'text-cortex-danger'}`}>
              {syncResult.message}
            </p>
          )}
          <button onClick={handleSyncCallLogs} disabled={syncing} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Call Logs from ZIWO'}
          </button>
          <NewBadge description="New — pulls the last 30 days of call history from ZIWO into Cortex. Run once to backfill historical data. New calls are logged automatically after each ZIWO call." />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-cortex-border">
        <button
          onClick={() => setTab('workflows')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'workflows' ? 'text-cortex-accent border-cortex-accent' : 'text-cortex-muted border-transparent hover:text-cortex-text'}`}
        >
          <Activity className="w-3.5 h-3.5" /> Workflows
        </button>
        <button
          onClick={() => setTab('calls')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'calls' ? 'text-cortex-accent border-cortex-accent' : 'text-cortex-muted border-transparent hover:text-cortex-text'}`}
        >
          <Phone className="w-3.5 h-3.5" /> Call Logs
          <NewBadge description="New tab — view all ZIWO call records. Filter by agent, direction (inbound/outbound), or whether a ticket was created. Shows ticket link or 'No ticket' badge per call." />
        </button>
      </div>

      {/* ── Workflows tab ── */}
      {tab === 'workflows' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cortex-border">
                  <th className="table-header">Status</th>
                  <th className="table-header">Workflow</th>
                  <th className="table-header">Entity</th>
                  <th className="table-header">Action</th>
                  <th className="table-header">Details</th>
                  <th className="table-header">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cortex-border">
                {logsLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}><td className="table-cell" colSpan="6"><div className="h-10 bg-cortex-bg animate-pulse rounded-lg" /></td></tr>
                  ))
                ) : logs && logs.length > 0 ? (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-cortex-surface-raised transition-colors">
                      <td className="table-cell"><StatusBadge status={log.status} /></td>
                      <td className="table-cell"><span className="text-xs font-mono text-cortex-text">{log.workflow_name || '—'}</span></td>
                      <td className="table-cell"><span className="text-sm text-cortex-muted">{log.entity_type || '—'}</span></td>
                      <td className="table-cell"><span className="text-sm font-medium text-cortex-text">{log.action || '—'}</span></td>
                      <td className="table-cell max-w-xs">
                        {log.details ? (
                          <pre className="text-xs font-mono text-cortex-muted overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : <span className="text-cortex-muted text-sm">—</span>}
                        {log.error_message && <p className="text-xs text-cortex-danger mt-1 font-mono">{log.error_message}</p>}
                      </td>
                      <td className="table-cell"><span className="text-xs font-mono text-cortex-muted">{formatDate(log.created_at)}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="table-cell text-center py-14 text-cortex-muted">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No logs found</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Calls tab ── */}
      {tab === 'calls' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card">
            <div className="grid grid-cols-3 gap-3">
              <select
                value={callFilters.agent_id}
                onChange={e => setCallFilters(f => ({ ...f, agent_id: e.target.value }))}
                className="input"
              >
                <option value="">All Agents</option>
                {agents.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
              <select
                value={callFilters.direction}
                onChange={e => setCallFilters(f => ({ ...f, direction: e.target.value }))}
                className="input"
              >
                <option value="">All Directions</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
              <select
                value={callFilters.has_ticket}
                onChange={e => setCallFilters(f => ({ ...f, has_ticket: e.target.value }))}
                className="input"
              >
                <option value="">All Calls</option>
                <option value="yes">Ticket Created</option>
                <option value="no">No Ticket</option>
              </select>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cortex-border">
                    <th className="table-header">Agent</th>
                    <th className="table-header text-center">Direction</th>
                    <th className="table-header">Number</th>
                    <th className="table-header text-center">Duration</th>
                    <th className="table-header">Cause</th>
                    <th className="table-header">Ticket</th>
                    <th className="table-header">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cortex-border">
                  {callsLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}><td className="table-cell" colSpan="7"><div className="h-10 bg-cortex-bg animate-pulse rounded-lg" /></td></tr>
                    ))
                  ) : callLogs.length > 0 ? (
                    callLogs.map(c => (
                      <tr key={c.id} className="hover:bg-cortex-surface-raised transition-colors">
                        <td className="table-cell">
                          <p className="text-sm text-cortex-text font-medium">{c.agent_name || '—'}</p>
                          <p className="text-xs text-cortex-muted font-mono">{c.agent_email}</p>
                        </td>
                        <td className="table-cell text-center">
                          <span className={`badge inline-flex items-center gap-1 text-xs ${c.direction === 'inbound' ? 'text-cortex-success bg-cortex-success/10' : 'text-cortex-warning bg-cortex-warning/10'}`}>
                            {c.direction === 'inbound' ? <PhoneIncoming className="w-3 h-3" /> : <PhoneOutgoing className="w-3 h-3" />}
                            {c.direction}
                          </span>
                        </td>
                        <td className="table-cell font-mono text-xs text-cortex-muted">{c.customer_number || '—'}</td>
                        <td className="table-cell text-center font-mono text-sm">{fmtSecs(c.duration_secs)}</td>
                        <td className="table-cell text-sm text-cortex-muted capitalize">{c.hangup_cause || 'normal'}</td>
                        <td className="table-cell">
                          {c.ticket_ref ? (
                            <Link href={`/tickets/${c.ticket_ref}`} className="flex items-center gap-1.5 text-xs text-cortex-accent hover:underline">
                              <Ticket className="w-3 h-3 flex-shrink-0" />
                              #{c.ticket_ref}
                            </Link>
                          ) : (
                            <span className="badge bg-cortex-muted/10 text-cortex-muted text-xs">No ticket</span>
                          )}
                        </td>
                        <td className="table-cell text-xs text-cortex-muted">{formatDate(c.started_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="7" className="table-cell text-center py-14 text-cortex-muted">
                      <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>No call logs found</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
