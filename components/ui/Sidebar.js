'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import ThemeToggle from './ThemeToggle'
import {
  LayoutDashboard,
  Ticket,
  AlertTriangle,
  TrendingUp,
  Settings,
  Activity,
  Clock,
  Shuffle,
  LogOut,
  BookOpen,
  Users,
  CalendarDays,
  RadioTower,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import NotificationBell from './NotificationBell'

const navigation = [
  { name: 'Dashboard',     href: '/dashboard',     icon: LayoutDashboard },
  { name: 'Tickets',       href: '/tickets',        icon: Ticket },
  { name: 'SLA Monitor',   href: '/sla',            icon: Clock },
  { name: 'Escalations',   href: '/escalations',    icon: AlertTriangle },
  { name: 'Analytics',     href: '/analytics',      icon: TrendingUp },
  { name: 'Agent Status',  href: '/agent-status',   icon: Users },
  { name: 'Rota',          href: '/rota',           icon: CalendarDays },
  { name: 'Knowledge Base',href: '/knowledge-base', icon: BookOpen },
  { name: 'QA Sampling',   href: '/qa',             icon: Shuffle },
  { name: 'System Logs',   href: '/logs',           icon: Activity },
  { name: 'Admin',         href: '/admin',          icon: Settings },
]

function getInitials(str = '') {
  return str.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??'
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="flex flex-col w-64 h-screen bg-cortex-surface border-r border-cortex-border fixed left-0 top-0 overflow-hidden">

      {/* Subtle top-accent gradient bleed */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cortex-accent/5 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="relative flex items-center gap-3 px-5 py-5 border-b border-cortex-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cortex-accent text-white flex-shrink-0">
          <RadioTower className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-base font-display font-bold tracking-tight text-cortex-text leading-none">
            Cortex <span className="text-cortex-accent">2.0</span>
          </h1>
          <p className="text-[10px] text-cortex-muted mt-0.5 font-mono tracking-wider uppercase">
            Support Ops
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                isActive
                  ? 'bg-cortex-accent/10 text-cortex-accent'
                  : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised'
              )}
            >
              {/* Active left-bar indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cortex-accent rounded-r-full" />
              )}
              <Icon className={cn(
                'w-4 h-4 flex-shrink-0 transition-colors',
                isActive ? 'text-cortex-accent' : 'text-cortex-muted group-hover:text-cortex-text'
              )} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="relative px-3 pb-4 pt-3 border-t border-cortex-border space-y-3">

        {/* Controls row */}
        <div className="flex items-center gap-2 px-1">
          <ThemeToggle />
          <NotificationBell />
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-1.5 h-1.5 bg-cortex-success rounded-full animate-pulse" />
            <span className="text-[10px] text-cortex-muted font-mono">Online</span>
          </div>
        </div>

        {/* User card */}
        {session?.user && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cortex-surface-raised border border-cortex-border">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-cortex-accent/15 text-cortex-accent text-xs font-display font-bold flex items-center justify-center flex-shrink-0 select-none">
              {getInitials(session.user.name || session.user.email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-cortex-text truncate leading-tight">
                {session.user.name || session.user.email.split('@')[0]}
              </p>
              <p className="text-[10px] font-mono text-cortex-muted capitalize mt-0.5">
                {session.user.role}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-cortex-muted hover:text-cortex-danger transition-colors p-1 rounded"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
