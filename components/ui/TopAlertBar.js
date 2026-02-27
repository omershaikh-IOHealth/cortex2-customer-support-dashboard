'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getCriticalSLA } from '@/lib/api'

export default function TopAlertBar() {
  const [dismissed, setDismissed] = useState(false)

  const { data } = useQuery({
    queryKey: ['sla-critical-bar'],
    queryFn: getCriticalSLA,
    refetchInterval: 60000,
  })

  const criticalTickets = (Array.isArray(data) ? data : []).filter(t =>
    ['critical', 'breached', 'at_risk'].includes(t.sla_status)
  )

  if (dismissed || criticalTickets.length === 0) return null

  return (
    <div className="w-full bg-cortex-danger/8 border-b border-cortex-danger/20 px-4 py-2 flex items-center gap-3 text-sm">
      <AlertTriangle className="w-3.5 h-3.5 text-cortex-danger shrink-0 animate-pulse" />
      <span className="text-cortex-danger font-semibold text-xs shrink-0">
        {criticalTickets.length} SLA {criticalTickets.length === 1 ? 'breach' : 'breaches'}
      </span>

      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-none">
        {criticalTickets.slice(0, 4).map(t => (
          <Link
            key={t.id}
            href={`/tickets/${t.id}`}
            className="flex items-center gap-1 text-xs bg-cortex-danger/15 hover:bg-cortex-danger/25 border border-cortex-danger/20 rounded-lg px-2 py-1 text-cortex-danger font-mono whitespace-nowrap transition-colors"
          >
            #{t.id} · {Math.round(t.sla_consumption_pct || 100)}%
            <ArrowRight className="w-2.5 h-2.5" />
          </Link>
        ))}
        {criticalTickets.length > 4 && (
          <Link href="/sla" className="text-xs text-cortex-danger hover:underline whitespace-nowrap font-mono">
            +{criticalTickets.length - 4} more →
          </Link>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-cortex-danger/50 hover:text-cortex-danger transition-colors ml-auto p-0.5"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
