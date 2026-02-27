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
  User,
  Coffee,
  Wifi,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Briefing', href: '/briefing', icon: BookOpen },
  { name: 'My Tickets', href: '/my-tickets', icon: Ticket },
  { name: 'My Dashboard', href: '/agent-dashboard', icon: BarChart2 },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen },
]

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', icon: Wifi, color: 'text-cortex-success', dot: 'bg-cortex-success' },
  { value: 'break', label: 'On Break', icon: Coffee, color: 'text-blue-400', dot: 'bg-blue-400' },
  { value: 'not_ready', label: 'Not Ready', icon: AlertCircle, color: 'text-cortex-danger', dot: 'bg-cortex-danger' },
]

function fmtDuration(secs) {
  const h = Math.floor(secs / 3600).toString().padStart(2, '0')
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function AgentSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [status, setStatus] = useState('available')
  const [statusSince, setStatusSince] = useState(null) // ISO string
  const [elapsed, setElapsed] = useState(0)           // seconds
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const currentStatus = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  const StatusIcon = currentStatus.icon

  // Load current status from DB on mount
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

  // Listen for ZIWO connect event — sync displayed status to 'available'
  useEffect(() => {
    function onZiwoConnected() {
      setStatus('available')
      setStatusSince(new Date().toISOString())
    }
    window.addEventListener('cortex-ziwo-connected', onZiwoConnected)
    return () => window.removeEventListener('cortex-ziwo-connected', onZiwoConnected)
  }, [])

  // Elapsed timer — ticks every second
  useEffect(() => {
    if (!statusSince) return
    function tick() {
      setElapsed(Math.floor((Date.now() - new Date(statusSince).getTime()) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [statusSince])

  // Close dropdown on outside click
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
      // Notify ZiwoWidget to sync status
      window.dispatchEvent(new CustomEvent('cortex-status-change', { detail: { status: newStatus } }))
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="flex flex-col w-52 h-screen bg-cortex-surface border-r border-cortex-border fixed left-0 top-0">
      {/* Logo */}
      <div className="p-5 border-b border-cortex-border">
        <h1 className="text-xl font-display font-bold bg-gradient-to-r from-cortex-accent to-blue-400 bg-clip-text text-transparent">
          CORTEX 2.0
        </h1>
        <p className="text-xs text-cortex-muted mt-0.5 font-mono">Agent Portal</p>
      </div>

      {/* Status selector */}
      <div className="relative border-b border-cortex-border" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(d => !d)}
          disabled={updatingStatus}
          className={cn(
            'flex items-center gap-2 px-3 py-2.5 w-full text-left text-sm font-medium transition-colors hover:bg-cortex-bg',
            currentStatus.color
          )}
          title="Click to change status"
        >
          <span className={cn('w-2 h-2 rounded-full shrink-0', currentStatus.dot, status !== 'offline' && 'animate-pulse')} />
          <span className="flex-1">{currentStatus.label}</span>
          {updatingStatus
            ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            : <ChevronDown className="w-3 h-3 text-cortex-muted" />}
        </button>

        {/* Duration display */}
        <div className="px-3 pb-2 text-xs font-mono text-cortex-muted tabular-nums">
          {fmtDuration(elapsed)}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-50 bg-cortex-surface border border-cortex-border rounded-b-lg shadow-xl overflow-hidden">
            {STATUS_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => changeStatus(opt.value)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-cortex-bg transition-colors',
                    opt.value === status ? opt.color + ' bg-cortex-bg' : 'text-cortex-muted'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', opt.dot)} />
                  <Icon className="w-4 h-4" />
                  <span>{opt.label}</span>
                  {opt.value === status && <span className="ml-auto text-xs">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-cortex-accent/10 text-cortex-accent'
                  : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-bg'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive && 'text-cortex-accent')} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-cortex-border space-y-2">
        <div className="flex items-center gap-2 px-1">
          <ThemeToggle />
          <NotificationBell />
        </div>

        {session?.user && (
          <div className="px-2 py-2 rounded-lg bg-cortex-bg border border-cortex-border">
            <div className="flex items-center gap-1.5 mb-1">
              <User className="w-3 h-3 text-cortex-muted shrink-0" />
              <span className="text-xs font-medium text-cortex-text truncate">
                {session.user.name || session.user.email}
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-1 text-xs text-cortex-muted hover:text-cortex-danger transition-colors w-full"
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
