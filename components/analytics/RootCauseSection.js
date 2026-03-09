'use client'

/* NEW: Root Cause Analysis section — top recurring modules as styled progress rows */

import { useQuery } from '@tanstack/react-query'
import { getTicketsByModule } from '@/lib/api'
import { Search } from 'lucide-react'
import NewBadge from '@/components/ui/NewBadge'

const ROW_COLORS = [
  'from-cortex-danger/50 to-cortex-danger/10',
  'from-orange-400/50 to-orange-400/10',
  'from-cortex-warning/50 to-cortex-warning/10',
  'from-blue-400/50 to-blue-400/10',
  'from-purple-400/50 to-purple-400/10',
  'from-teal-400/50 to-teal-400/10',
  'from-cortex-accent/50 to-cortex-accent/10',
  'from-cortex-muted/40 to-cortex-muted/5',
]

const FILL_COLORS = [
  'bg-cortex-danger',
  'bg-orange-400',
  'bg-cortex-warning',
  'bg-blue-400',
  'bg-purple-400',
  'bg-teal-400',
  'bg-cortex-accent',
  'bg-cortex-muted',
]

export default function RootCauseSection({ days = 30 }) {
  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['by-module', days],
    queryFn: () => getTicketsByModule(days),
  })

  const maxCount = modules.length > 0 ? modules[0].count : 1

  return (
    /* NEW: Root Cause Analysis section */
    <div data-new="true" className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-cortex-danger" />
        <h2 className="font-display font-bold text-cortex-text">Root Cause Analysis</h2>
        <NewBadge description="New section — top modules by ticket count, showing recurring incident patterns." />
      </div>

      <div className="card">
        <h3 className="font-semibold text-cortex-text text-sm mb-5">Top Recurring Issue Categories</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-cortex-bg animate-pulse rounded-xl" />)}
          </div>
        ) : modules.length > 0 ? (
          <div className="space-y-2">
            {modules.slice(0, 8).map((mod, i) => {
              const barPct = maxCount > 0 ? (mod.count / maxCount) * 100 : 0

              return (
                <div key={mod.module} className="flex items-center gap-3 group">
                  {/* Rank */}
                  <span className="w-5 text-[10px] font-mono text-cortex-muted text-right flex-shrink-0">
                    {i + 1}
                  </span>

                  {/* Module name */}
                  <div className="w-36 flex-shrink-0 truncate">
                    <p className="text-xs font-medium text-cortex-text truncate">{mod.module}</p>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 h-5 bg-cortex-bg rounded-md overflow-hidden">
                    <div
                      className={`h-full rounded-md ${FILL_COLORS[i] || FILL_COLORS[7]} opacity-70 transition-all`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  {/* Count */}
                  <span className="w-12 text-right font-mono text-xs font-semibold text-cortex-text flex-shrink-0">
                    {mod.count}
                  </span>

                  {/* Pct */}
                  <span className="w-10 text-right font-mono text-xs text-cortex-muted flex-shrink-0">
                    {mod.pct}%
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-center py-10 text-cortex-muted text-sm">No module data for selected period</p>
        )}
      </div>
    </div>
  )
}
