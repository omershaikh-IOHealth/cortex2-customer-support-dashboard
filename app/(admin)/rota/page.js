'use client'

import RotaManagementSection from '@/components/ui/RotaManagementSection'

export default function RotaPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Scheduling</p>
        <h1 className="text-3xl font-display font-bold text-cortex-text">Rota Management</h1>
        <p className="text-cortex-muted text-sm mt-0.5">Manage agent shift schedules and break windows</p>
      </div>
      <RotaManagementSection />
    </div>
  )
}
