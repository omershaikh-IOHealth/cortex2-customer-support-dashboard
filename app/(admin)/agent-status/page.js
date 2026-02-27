'use client'

import AgentStatusSection from '@/components/ui/AgentStatusSection'

export default function AgentStatusPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">Agent Status</h1>
        <p className="text-cortex-muted">Live view of all agent availability and activity</p>
      </div>
      <AgentStatusSection />
    </div>
  )
}
