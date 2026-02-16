'use client'

import { useQuery } from '@tanstack/react-query'
import { getSLAConfig, getEscalationConfig } from '@/lib/api'
import { Settings } from 'lucide-react'

export default function ConfigPage() {
  const { data: slaConfig, isLoading: slaLoading } = useQuery({
    queryKey: ['sla-config'],
    queryFn: getSLAConfig,
  })

  const { data: escalationConfig, isLoading: escalationLoading } = useQuery({
    queryKey: ['escalation-config'],
    queryFn: getEscalationConfig,
  })

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">Configuration</h1>
        <p className="text-cortex-muted">System settings and parameters</p>
      </div>

      {/* SLA Configuration */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-cortex-accent" />
          <h2 className="text-xl font-display font-bold">SLA Configuration</h2>
        </div>

        {slaLoading ? (
          <div className="h-64 bg-cortex-bg animate-pulse rounded-lg"></div>
        ) : slaConfig && slaConfig.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cortex-bg">
                <tr>
                  <th className="table-header">Priority</th>
                  <th className="table-header">Name</th>
                  <th className="table-header">Response (hrs)</th>
                  <th className="table-header">Resolution (hrs)</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cortex-border">
                {slaConfig.map((config) => (
                  <tr key={config.id} className="hover:bg-cortex-bg/50">
                    <td className="table-cell">
                      <span className="badge bg-cortex-accent/10 text-cortex-accent font-mono">
                        {config.priority}
                      </span>
                    </td>
                    <td className="table-cell font-medium">{config.priority_name || 'N/A'}</td>
                    <td className="table-cell text-center font-mono">
                      {config.response_hours || 'N/A'}
                    </td>
                    <td className="table-cell text-center font-mono">
                      {config.resolution_hours || 'N/A'}
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-cortex-surface">
                        {config.resolution_type}
                      </span>
                    </td>
                    <td className="table-cell text-sm text-cortex-muted">
                      {config.priority_description || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-12 text-cortex-muted">No SLA configuration found</p>
        )}
      </div>

      {/* Escalation Configuration */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-cortex-danger" />
          <h2 className="text-xl font-display font-bold">Escalation Configuration</h2>
        </div>

        {escalationLoading ? (
          <div className="h-64 bg-cortex-bg animate-pulse rounded-lg"></div>
        ) : escalationConfig && escalationConfig.length > 0 ? (
          <div className="space-y-4">
            {escalationConfig.map((config) => (
              <div key={config.id} className="p-4 bg-cortex-bg rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="badge bg-cortex-danger/10 text-cortex-danger">
                        Level {config.level}
                      </span>
                      <span className="font-semibold">{config.level_name}</span>
                    </div>
                    <p className="text-sm text-cortex-muted">
                      Threshold: {config.threshold_percent}% SLA consumption
                    </p>
                  </div>
                </div>

                {config.action_description && (
                  <div className="mb-3">
                    <p className="text-xs text-cortex-muted mb-1">Action Required:</p>
                    <p className="text-sm">{config.action_description}</p>
                  </div>
                )}

                {config.notify_roles && config.notify_roles.length > 0 && (
                  <div>
                    <p className="text-xs text-cortex-muted mb-1">Notify Roles:</p>
                    <div className="flex flex-wrap gap-2">
                      {config.notify_roles.map((role, idx) => (
                        <span key={idx} className="badge bg-cortex-surface">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-12 text-cortex-muted">No escalation configuration found</p>
        )}
      </div>

      {/* Info */}
      <div className="card bg-cortex-accent/5 border-cortex-accent/20">
        <p className="text-sm text-cortex-muted">
          <strong>Note:</strong> Configuration values are read-only and managed through the database. 
          Contact your system administrator to modify these settings.
        </p>
      </div>
    </div>
  )
}
