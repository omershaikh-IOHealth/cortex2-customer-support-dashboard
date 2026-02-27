'use client'

import { useQuery } from '@tanstack/react-query'
import { getLogs } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Activity, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

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

export default function LogsPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => getLogs(100),
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Diagnostics</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">System Logs</h1>
        </div>
        {logs && (
          <p className="text-xs text-cortex-muted font-mono pb-1">Last {logs.length} entries</p>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cortex-border">
                <th className="table-header rounded-tl-xl">Status</th>
                <th className="table-header">Workflow</th>
                <th className="table-header">Entity</th>
                <th className="table-header">Action</th>
                <th className="table-header">Details</th>
                <th className="table-header rounded-tr-xl">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell" colSpan="6">
                      <div className="h-10 bg-cortex-bg animate-pulse rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : logs && logs.length > 0 ? (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-cortex-surface-raised transition-colors group">
                    <td className="table-cell">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono text-cortex-text">{log.workflow_name || '—'}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-cortex-muted">{log.entity_type || '—'}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm font-medium text-cortex-text">{log.action || '—'}</span>
                    </td>
                    <td className="table-cell max-w-xs">
                      {log.details ? (
                        <pre className="text-xs font-mono text-cortex-muted overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-cortex-muted text-sm">—</span>
                      )}
                      {log.error_message && (
                        <p className="text-xs text-cortex-danger mt-1 font-mono">{log.error_message}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono text-cortex-muted">{formatDate(log.created_at)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="table-cell text-center py-14 text-cortex-muted">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No logs found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
