'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function fetchCritical() {
  return fetch('/api/sla/critical').then(r => r.ok ? r.json() : [])
}

export default function TopAlertBar() {
  const [dismissed, setDismissed] = useState(false)

  const { data } = useQuery({
    queryKey: ['sla-critical-bar'],
    queryFn: fetchCritical,
    refetchInterval: 60000,
  })

  const criticalTickets = (Array.isArray(data) ? data : []).filter(t => ['critical', 'breached', 'at_risk'].includes(t.sla_status))

  if (dismissed || criticalTickets.length === 0) return null

  return (
    <div className="w-full bg-cortex-danger/10 border-b border-cortex-danger/30 px-4 py-2 flex items-center gap-3 text-sm">
      <AlertTriangle className="w-4 h-4 text-cortex-danger shrink-0 animate-pulse" />
      <span className="text-cortex-danger font-medium shrink-0">
        {criticalTickets.length} critical SLA {criticalTickets.length === 1 ? 'breach' : 'breaches'}
      </span>
      <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none">
        {criticalTickets.slice(0, 3).map(t => (
          <Link
            key={t.id}
            href={`/tickets/${t.id}`}
            className="flex items-center gap-1 text-xs bg-cortex-danger/20 hover:bg-cortex-danger/30 border border-cortex-danger/30 rounded px-2 py-1 text-cortex-danger font-mono whitespace-nowrap transition-colors"
          >
            #{t.id} · {Math.round(t.sla_consumption_pct || 100)}%
            <ArrowRight className="w-3 h-3" />
          </Link>
        ))}
        {criticalTickets.length > 3 && (
          <Link href="/sla" className="text-xs text-cortex-danger hover:underline whitespace-nowrap">
            +{criticalTickets.length - 3} more →
          </Link>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-cortex-danger/60 hover:text-cortex-danger transition-colors ml-auto"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
