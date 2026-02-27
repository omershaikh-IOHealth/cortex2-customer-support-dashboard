'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import {
  BookOpen,
  Ticket,
  BarChart2,
  LogOut,
  Coffee,
  Wifi,
  AlertCircle,
  ChevronDown,
  Users,
  RadioTower,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Briefing',       href: '/briefing',        icon: BookOpen },
  { name: 'My Tickets',     href: '/my-tickets',      icon: Ticket },
  { name: 'My Dashboard',   href: '/agent-dashboard', icon: BarChart2 },
  { name: 'Knowledge Base', href: '/knowledge-base',  icon: BookOpen },
]

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available',  icon: Wifi,        color: 'text-cortex-success', dot: 'bg-cortex-success',  ring: 'ring-cortex-success/30' },
  { value: 'break',     label: 'On Break',   icon: Coffee,      color: 'text-blue-400',        dot: 'bg-blue-400',        ring: 'ring-blue-400/30' },
  { value: 'meeting',   label: 'Meeting',    icon: Users,       color: 'text-purple-400',      dot: 'bg-purple-400',      ring: 'ring-purple-400/30' },
  { value: 'not_ready', label: 'Not Ready',  icon: AlertCircle, color: 'text-cortex-danger',   dot: 'bg-cortex-danger',   ring: 'ring-cortex-danger/30' },
]

function fmtDuration(secs) {
  const h = Math.floor(secs / 3600).toString().padStart(2, '0')
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function getInitials(str = '') {
  return str.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??'
}

export default function AgentSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [status, setStatus] = useState('available')
  const [statusSince, setStatusSince] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const currentStatus = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  const StatusIcon = currentStatus.icon

  useEffect(() => {
    if (!session?.user?.id) return
    fetch(`/api/users/${session.user.id}/status`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.status) {
          setStatus(data.status)
          setStatusSince(data.set_at || new Date().toISOString())
        }
      })
      .catch(() => {})
  }, [session?.user?.id])

  useEffect(() => {
    function onZiwoConnected() {
      setStatus('available')
      setStatusSince(new Date().toISOString())
    }
    window.addEventListener('cortex-ziwo-connected', onZiwoConnected)
    return () => window.removeEventListener('cortex-ziwo-connected', onZiwoConnected)
  }, [])

  useEffect(() => {
    if (!statusSince) return
    function tick() {
      setElapsed(Math.floor((Date.now() - new Date(statusSince).getTime()) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [statusSince])

  useEffect(() => {
    if (!showDropdown) return
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  async function changeStatus(newStatus) {
    setShowDropdown(false)
    if (newStatus === status) return
    setUpdatingStatus(true)
    try {
      await fetch(`/api/users/${session?.user?.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setStatus(newStatus)
      setStatusSince(new Date().toISOString())
      setElapsed(0)

      fetch('/api/ziwo/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      }).catch(() => {})

      window.dispatchEvent(new CustomEvent('cortex-status-change', { detail: { status: newStatus } }))
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="flex flex-col w-52 h-screen bg-cortex-surface border-r border-cortex-border fixed left-0 top-0 overflow-hidden">

      {/* Subtle top-accent gradient bleed */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cortex-accent/5 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="relative flex items-center gap-2.5 px-4 py-4 border-b border-cortex-border">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-cortex-accent text-white flex-shrink-0">
          <RadioTower className="w-3.5 h-3.5" />
        </div>
        <div>
          <h1 className="text-sm font-display font-bold tracking-tight text-cortex-text leading-none">
            Cortex <span className="text-cortex-accent">2.0</span>
          </h1>
          <p className="text-[10px] text-cortex-muted mt-0.5 font-mono tracking-wider uppercase">
            Agent
          </p>
        </div>
      </div>

      {/* Status selector */}
      <div className="relative border-b border-cortex-border" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(d => !d)}
          disabled={updatingStatus}
          className="flex items-center gap-2.5 px-4 py-3 w-full text-left text-sm transition-colors hover:bg-cortex-surface-raised"
        >
          {/* Status dot with pulse ring */}
          <span className="relative flex-shrink-0">
            <span className={cn(
              'block w-2 h-2 rounded-full',
              currentStatus.dot
            )} />
            {status !== 'offline' && (
              <span className={cn(
                'absolute inset-0 rounded-full animate-ping opacity-60',
                currentStatus.dot
              )} />
            )}
          </span>

          <span className={cn('flex-1 font-medium text-sm', currentStatus.color)}>
            {currentStatus.label}
          </span>

          {updatingStatus
            ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <ChevronDown className={cn('w-3 h-3 flex-shrink-0 text-cortex-muted transition-transform', showDropdown && 'rotate-180')} />
          }
        </button>

        {/* Duration badge */}
        <div className="px-4 pb-2.5 flex items-center gap-1.5">
          <span className="text-xs font-mono text-cortex-muted tabular-nums">
            {fmtDuration(elapsed)}
          </span>
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-50 bg-cortex-surface border-x border-b border-cortex-border rounded-b-xl shadow-xl overflow-hidden animate-slide-in">
            {STATUS_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => changeStatus(opt.value)}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-4 py-2.5 text-sm transition-colors',
                    opt.value === status
                      ? cn('bg-cortex-surface-raised font-medium', opt.color)
                      : 'text-cortex-muted hover:bg-cortex-surface-raised hover:text-cortex-text'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', opt.dot)} />
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{opt.label}</span>
                  {opt.value === status && (
                    <span className="ml-auto text-xs opacity-60">✓</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
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
      <div className="relative px-3 pb-3 pt-3 border-t border-cortex-border space-y-2.5">

        <div className="flex items-center gap-2 px-1">
          <ThemeToggle />
          <NotificationBell />
        </div>

        {session?.user && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-cortex-surface-raised border border-cortex-border">
            <div className="w-7 h-7 rounded-lg bg-cortex-accent/15 text-cortex-accent text-xs font-display font-bold flex items-center justify-center flex-shrink-0 select-none">
              {getInitials(session.user.name || session.user.email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-cortex-text truncate leading-tight">
                {session.user.name || session.user.email.split('@')[0]}
              </p>
              <p className="text-[10px] font-mono text-cortex-muted capitalize mt-0.5">Agent</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-cortex-muted hover:text-cortex-danger transition-colors p-1 rounded flex-shrink-0"
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
