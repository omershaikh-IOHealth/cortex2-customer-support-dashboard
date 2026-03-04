'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

const INTEGRATIONS = [
  { key: 'database', label: 'Database',   emoji: '🗄️', desc: 'PostgreSQL via Supabase' },
  { key: 'clickup',  label: 'ClickUp',    emoji: '✅', desc: 'Ticket sync & task management' },
  { key: 'ziwo',     label: 'ZIWO',       emoji: '📞', desc: 'Call centre platform' },
  { key: 'n8n',      label: 'n8n',        emoji: '⚙️', desc: 'Automation & webhook runner' },
  { key: 'ai',       label: 'AI (Core42)',emoji: '🤖', desc: 'AI Companion & sentiment analysis' },
  { key: 'zoho',     label: 'Zoho Desk',  emoji: '📧', desc: 'Email ticketing' },
]

function statusBadge(status) {
  if (!status || status === 'not_configured')
    return <span className="badge bg-cortex-muted/10 text-cortex-muted">Not configured</span>
  if (status === 'operational' || status === 'configured')
    return <span className="badge bg-cortex-success/15 text-cortex-success">Operational</span>
  if (status === 'degraded')
    return <span className="badge bg-cortex-warning/15 text-cortex-warning">Degraded</span>
  if (status === 'down')
    return <span className="badge bg-cortex-danger/15 text-cortex-danger">Down</span>
  return <span className="badge bg-cortex-muted/10 text-cortex-muted capitalize">{status}</span>
}

function statusDotClass(status) {
  if (status === 'operational' || status === 'configured') return 'bg-cortex-success animate-pulse'
  if (status === 'degraded') return 'bg-cortex-warning'
  if (status === 'down') return 'bg-cortex-danger'
  return 'bg-cortex-muted'
}

export default function IntegrationsPage() {
  const qc = useQueryClient()

  const { data: healthData, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: () => fetch('/api/health').then(r => r.json()),
    refetchInterval: 60000,
  })

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">System</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">Integrations</h1>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['health'] })}
          disabled={isFetching}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* NEW feature banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-cortex-accent/8 border border-cortex-accent/20 text-sm">
        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cortex-accent text-white rounded-full uppercase tracking-wide select-none leading-none flex-shrink-0 mt-0.5">NEW</span>
        <span className="text-cortex-muted leading-relaxed">
          <span className="font-semibold text-cortex-text">Integrations page</span> — Monitor the real-time health of all platform connections. Shows live status for Database, ClickUp, ZIWO (call centre), n8n (automation), AI (Core42), and Zoho. Auto-refreshes every 60 seconds, or use the Refresh button.
        </span>
      </div>

      {/* Overall status banner */}
      {healthData && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          healthData.status === 'healthy'
            ? 'bg-cortex-success/5 border-cortex-success/20'
            : 'bg-cortex-warning/5 border-cortex-warning/20'
        }`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${healthData.status === 'healthy' ? 'bg-cortex-success animate-pulse' : 'bg-cortex-warning'}`} />
          <p className="text-sm font-medium text-cortex-text">
            System {healthData.status === 'healthy' ? 'is fully operational' : 'has degraded services'}
          </p>
          <span className="ml-auto text-xs text-cortex-muted font-mono">
            {healthData.timestamp ? formatRelativeTime(healthData.timestamp) : ''}
          </span>
        </div>
      )}

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map(({ key, label, emoji, desc }) => {
          const check = healthData?.checks?.[key]
          const status = check?.status

          return (
            <div key={key} className="card flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cortex-bg border border-cortex-border flex items-center justify-center text-xl flex-shrink-0">
                    {emoji}
                  </div>
                  <div>
                    <p className="font-semibold text-cortex-text text-sm">{label}</p>
                    <p className="text-xs text-cortex-muted">{desc}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${statusDotClass(status)}`} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(status)}
                {check?.latency_ms != null && (
                  <span className="badge bg-cortex-bg text-cortex-muted border border-cortex-border font-mono text-[10px]">
                    {check.latency_ms}ms
                  </span>
                )}
              </div>

              {/* Extra detail rows */}
              <div className="space-y-1.5 text-xs text-cortex-muted font-mono border-t border-cortex-border pt-3">
                {key === 'ziwo' && check?.agents_configured != null && (
                  <div className="flex justify-between">
                    <span>Agents configured</span>
                    <span className="text-cortex-text">{check.agents_configured}</span>
                  </div>
                )}
                {key === 'n8n' && check?.last_run && (
                  <div className="flex justify-between">
                    <span>Last run</span>
                    <span className="text-cortex-text">{formatRelativeTime(check.last_run)}</span>
                  </div>
                )}
                {key === 'n8n' && check?.last_status && (
                  <div className="flex justify-between">
                    <span>Last status</span>
                    <span className={check.last_status === 'success' ? 'text-cortex-success' : 'text-cortex-danger'}>
                      {check.last_status}
                    </span>
                  </div>
                )}
                {key !== 'ziwo' && key !== 'n8n' && (
                  <div className="flex justify-between">
                    <span>Last checked</span>
                    <span className="text-cortex-text">{healthData?.timestamp ? formatRelativeTime(healthData.timestamp) : '—'}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
