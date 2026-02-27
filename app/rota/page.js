'use client'

import RotaManagementSection from '@/components/ui/RotaManagementSection'

export default function RotaPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-4xl font-display font-bold mb-2">Rota Management</h1>
        <p className="text-cortex-muted">Manage agent shift schedules and break windows</p>
      </div>
      <RotaManagementSection />
    </div>
  )
}
