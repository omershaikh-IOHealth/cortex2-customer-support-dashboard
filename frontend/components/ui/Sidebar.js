'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import { 
  LayoutDashboard, 
  Ticket, 
  AlertTriangle, 
  TrendingUp, 
  Settings,
  Activity,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tickets', href: '/tickets', icon: Ticket },
  { name: 'SLA Monitor', href: '/sla', icon: Clock },
  { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'System Logs', href: '/logs', icon: Activity },
  { name: 'Configuration', href: '/config', icon: Settings },
  { name: 'Admin', href: '/admin', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 h-screen bg-cortex-surface border-r border-cortex-border fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-cortex-border">
        <h1 className="text-2xl font-display font-bold text-gradient from-cortex-accent to-blue-400">
          CORTEX 2.0
        </h1>
        <p className="text-xs text-cortex-muted mt-1 font-mono">Support Automation</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-cortex-accent/10 text-cortex-accent'
                  : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'text-cortex-accent')} />
              <span className="font-medium">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-cortex-border space-y-3">
        <ThemeToggle />
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="w-2 h-2 bg-cortex-success rounded-full animate-pulse"></div>
          <span className="text-xs text-cortex-muted font-mono">System Online</span>
        </div>
      </div>
    </div>
  )
}