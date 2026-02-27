'use client'

import AgentStatusSection from '@/components/ui/AgentStatusSection'
import { Users } from 'lucide-react'

export default function AgentStatusPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Live</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">Agent Status</h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-cortex-muted font-mono pb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cortex-success animate-pulse" />
          Refreshing every 30s
        </div>
      </div>
      <AgentStatusSection />
    </div>
  )
}
