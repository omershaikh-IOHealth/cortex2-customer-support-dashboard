'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, X, Check, CheckCheck, AlertTriangle, ArrowUpCircle, Coffee, Ticket, Info } from 'lucide-react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/utils'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/api'

const TYPE_CONFIG = {
  sla_alert:       { icon: AlertTriangle, color: 'text-cortex-danger' },
  escalation:      { icon: ArrowUpCircle, color: 'text-cortex-warning' },
  break_exceeded:  { icon: Coffee,        color: 'text-blue-400' },
  assignment:      { icon: Ticket,        color: 'text-cortex-accent' },
  system:          { icon: Info,          color: 'text-cortex-muted' },
}

export default function NotificationBell() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  const { data = { notifications: [], unread_count: 0 } } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
  })

  const { notifications, unread_count } = data

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function markRead(id) {
    await markNotificationRead(id)
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function markAllRead() {
    await markAllNotificationsRead()
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-cortex-muted hover:text-cortex-text rounded-lg hover:bg-cortex-surface-raised transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread_count > 0 && (
          <span className="absolute top-1 right-1 w-3.5 h-3.5 flex items-center justify-center bg-cortex-danger text-white text-[9px] font-bold rounded-full">
            {unread_count > 9 ? '9+' : unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-cortex-surface border border-cortex-border rounded-2xl shadow-card-hover z-50 overflow-hidden animate-slide-in">
          {/* Header */}
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
                  className="p-1.5 text-cortex-muted hover:text-cortex-accent rounded-lg hover:bg-cortex-surface-raised transition-colors"
                  title="Mark all read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-cortex-muted hover:text-cortex-text rounded-lg hover:bg-cortex-surface-raised transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-cortex-border">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-cortex-muted text-sm">
                <Bell className="w-6 h-6 mx-auto mb-2 opacity-20" />
                All caught up
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
                const Icon = cfg.icon
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-cortex-surface-raised transition-colors ${!n.is_read ? 'bg-cortex-accent/5' : ''}`}
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
                      <p className="text-xs text-cortex-muted mt-1 font-mono">{formatRelativeTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="shrink-0 text-cortex-muted hover:text-cortex-success transition-colors p-0.5"
                        title="Mark read"
                      >
                        <Check className="w-3.5 h-3.5" />
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
