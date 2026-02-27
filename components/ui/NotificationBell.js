'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, X, Check, CheckCheck, AlertTriangle, ArrowUpCircle, Coffee, Ticket, Info } from 'lucide-react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'

const TYPE_CONFIG = {
  sla_alert:       { icon: AlertTriangle, color: 'text-cortex-danger' },
  escalation:      { icon: ArrowUpCircle, color: 'text-cortex-warning' },
  break_exceeded:  { icon: Coffee,        color: 'text-blue-400' },
  assignment:      { icon: Ticket,        color: 'text-cortex-accent' },
  system:          { icon: Info,          color: 'text-cortex-muted' },
}

function fetchNotifications() {
  return fetch('/api/notifications').then(r => r.ok ? r.json() : { notifications: [], unread_count: 0 })
}

export default function NotificationBell() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  const { data = { notifications: [], unread_count: 0 } } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  })

  const { notifications, unread_count } = data

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function markRead(id) {
    await fetch(`/api/notifications/${id}`, { method: 'PUT' })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-cortex-muted hover:text-cortex-text rounded-lg hover:bg-cortex-border/30 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread_count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-cortex-danger text-white text-[10px] font-bold rounded-full">
            {unread_count > 9 ? '9+' : unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-cortex-surface border border-cortex-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-cortex-border">
            <span className="font-semibold text-cortex-text text-sm">
              Notifications
              {unread_count > 0 && (
                <span className="ml-2 badge text-cortex-danger bg-cortex-danger/10 text-xs">{unread_count} new</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {unread_count > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-cortex-muted hover:text-cortex-accent flex items-center gap-1 transition-colors"
                  title="Mark all read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-cortex-muted hover:text-cortex-text rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-cortex-border">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-cortex-muted text-sm">
                <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                No notifications
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
                const Icon = cfg.icon
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-cortex-bg/50 transition-colors ${!n.is_read ? 'bg-cortex-accent/5' : ''}`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <Link href={n.link} onClick={() => { markRead(n.id); setOpen(false) }} className="block">
                          <p className="text-sm font-medium text-cortex-text leading-tight">{n.title}</p>
                          {n.body && <p className="text-xs text-cortex-muted mt-0.5 line-clamp-2">{n.body}</p>}
                        </Link>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-cortex-text leading-tight">{n.title}</p>
                          {n.body && <p className="text-xs text-cortex-muted mt-0.5 line-clamp-2">{n.body}</p>}
                        </>
                      )}
                      <p className="text-xs text-cortex-muted mt-1">{formatRelativeTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="shrink-0 text-cortex-muted hover:text-cortex-success transition-colors"
                        title="Mark read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
