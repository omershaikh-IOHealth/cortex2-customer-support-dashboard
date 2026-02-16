'use client'

import { useQuery } from '@tanstack/react-query'
import { getLogs } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Activity, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function LogsPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => getLogs(100),
    refetchInterval: 30000,
  })

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-cortex-success" />
      case 'error':
      case 'failed':
        return <XCircle className="w-4 h-4 text-cortex-danger" />
      default:
        return <AlertCircle className="w-4 h-4 text-cortex-warning" />
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">System Logs</h1>
        <p className="text-cortex-muted">Workflow execution and processing history</p>
      </div>

      {/* Logs List */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cortex-bg">
              <tr>
                <th className="table-header">Status</th>
                <th className="table-header">Workflow</th>
                <th className="table-header">Entity</th>
                <th className="table-header">Action</th>
                <th className="table-header">Details</th>
                <th className="table-header">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell" colSpan="6">
                      <div className="h-12 bg-cortex-bg animate-pulse rounded"></div>
                    </td>
                  </tr>
                ))
              ) : logs && logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-cortex-bg/50 transition-colors">
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className={`badge ${
                          log.status === 'success' ? 'bg-cortex-success/10 text-cortex-success' :
                          log.status === 'error' || log.status === 'failed' ? 'bg-cortex-danger/10 text-cortex-danger' :
                          'bg-cortex-warning/10 text-cortex-warning'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-sm">
                        {log.workflow_name || 'N/A'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm">{log.entity_type || 'N/A'}</span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-sm">{log.action || 'N/A'}</span>
                    </td>
                    <td className="table-cell">
                      {log.details ? (
                        <pre className="text-xs font-mono text-cortex-muted max-w-md overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-cortex-muted text-sm">-</span>
                      )}
                      {log.error_message && (
                        <p className="text-xs text-cortex-danger mt-1">{log.error_message}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="text-sm font-mono text-cortex-muted">
                        {formatDate(log.created_at)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="table-cell text-center py-12 text-cortex-muted">
                    No logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {logs && (
        <div className="text-sm text-cortex-muted text-center">
          Showing last {logs.length} log entries
        </div>
      )}
    </div>
  )
}
