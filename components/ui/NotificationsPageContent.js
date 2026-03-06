'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Bell, AlertTriangle, ArrowUpCircle, Coffee, Ticket, Info, Trash2, FileText, ArrowLeftRight, X } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { getNotifications, markNotificationRead, deleteNotification, clearAllNotifications } from '@/lib/api'

const TYPE_CONFIG = {
  sla_alert:      { icon: AlertTriangle, color: 'text-cortex-danger' },
  escalation:     { icon: ArrowUpCircle, color: 'text-cortex-warning' },
  break_exceeded: { icon: Coffee,        color: 'text-blue-400' },
  assignment:     { icon: Ticket,          color: 'text-cortex-accent' },
  leave_request:  { icon: FileText,        color: 'text-cortex-warning' },
  shift_swap:     { icon: ArrowLeftRight,  color: 'text-cortex-accent' },
  system:         { icon: Info,            color: 'text-cortex-muted' },
}

const TABS = [
  { key: 'all',          label: 'All' },
  { key: 'unread',       label: 'Unread' },
  { key: 'escalation',   label: 'Escalations' },
  { key: 'sla_alert',    label: 'SLA Alerts' },
  { key: 'leave_request',label: 'Leave' },
  { key: 'shift_swap',   label: 'Shift Swaps' },
  { key: 'system',       label: 'System' },
]

export default function NotificationsPageContent() {
  const router = useRouter()
  const qc = useQueryClient()
  const [tab, setTab] = useState('all')

  const { data = { notifications: [], unread_count: 0 }, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30000,
  })

  const { notifications, unread_count } = data

  const filtered = notifications.filter(n => {
    if (tab === 'all') return true
    if (tab === 'unread') return !n.is_read
    return n.type === tab
  })

  async function handleClick(n) {
    if (!n.is_read) {
      await markNotificationRead(n.id)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }
    if (n.link) router.push(n.link)
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    await deleteNotification(id)
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function handleClearAll() {
    await clearAllNotifications()
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* NEW feature banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-cortex-accent/8 border border-cortex-accent/20 text-sm">
        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cortex-accent text-white rounded-full uppercase tracking-wide select-none leading-none flex-shrink-0 mt-0.5">NEW</span>
        <span className="text-cortex-muted leading-relaxed">
          <span className="font-semibold text-cortex-text">Notification Centre</span> — Full-page inbox. Filter by All, Unread, Escalations, SLA Alerts, or System. Click any notification to mark it read and jump to the linked ticket. Use the &times; button to permanently delete a notification, or &ldquo;Clear all&rdquo; to wipe the entire inbox at once.
        </span>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Inbox</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">
            Notifications
            {unread_count > 0 && (
              <span className="ml-3 badge bg-cortex-danger/15 text-cortex-danger text-base">{unread_count} new</span>
            )}
          </h1>
        </div>
        {notifications.length > 0 && (
          <button onClick={handleClearAll} className="btn-secondary flex items-center gap-2 text-cortex-danger border-cortex-danger/30 hover:bg-cortex-danger/10">
            <Trash2 className="w-3.5 h-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-cortex-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'text-cortex-accent border-cortex-accent'
                : 'text-cortex-muted border-transparent hover:text-cortex-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="card p-0 overflow-hidden divide-y divide-cortex-border">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 px-5 py-4">
              <div className="w-8 h-8 rounded-lg bg-cortex-bg animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-cortex-bg animate-pulse rounded w-2/3" />
                <div className="h-3 bg-cortex-bg animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-cortex-muted">
            <Bell className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">{tab === 'unread' ? 'All caught up' : 'No notifications'}</p>
          </div>
        ) : (
          filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
            const Icon = cfg.icon
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-cortex-surface-raised transition-colors group ${
                  !n.is_read ? 'bg-cortex-accent/5' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  !n.is_read ? 'bg-cortex-accent/10' : 'bg-cortex-bg'
                }`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cortex-text leading-tight">{n.title}</p>
                  {n.body && <p className="text-xs text-cortex-muted mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-cortex-muted font-mono mt-1">{formatRelativeTime(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-cortex-accent" />
                  )}
                  <button
                    onClick={(e) => handleDelete(e, n.id)}
                    title="Clear notification"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-cortex-muted hover:text-cortex-danger hover:bg-cortex-danger/10 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
