'use client'

import { useState, Suspense } from 'react'
import NewBadge from '@/components/ui/NewBadge'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Ticket,
  Clock,
  AlertTriangle,
  Search,
  Building2,
  X,
} from 'lucide-react'
import { getSLAStatusColor, getPriorityColor, formatRelativeTime, cn } from '@/lib/utils'
import TicketThread from '@/components/tickets/TicketThread'
import TicketSidebar from '@/components/tickets/TicketSidebar'

const STATUS_TABS = [
  { key: 'all',         label: 'All',         filter: {},                    channelFilter: null },
  { key: 'open',        label: 'Open',        filter: { status: 'Open' },    channelFilter: null },
  { key: 'in_progress', label: 'In Progress', filter: { status: 'In Progress' }, channelFilter: null },
  { key: 'waiting',     label: 'Waiting',     filter: { status: 'Waiting' }, channelFilter: null },
  { key: 'resolved',    label: 'Resolved',    filter: { status: 'complete' }, channelFilter: null },
  { key: 'voice',       label: '📞 Voice',    filter: {},                    channelFilter: 'voice' },
  { key: 'email',       label: '✉ Email',     filter: {},                    channelFilter: 'email' },
]

function fetchMyTickets(params = {}) {
  const qs = new URLSearchParams({ limit: '100', ...params }).toString()
  return fetch(`/api/tickets?${qs}`).then(r => r.ok ? r.json() : { tickets: [], total: 0 })
}

function getSLABarColor(slaStatus) {
  const map = {
    healthy: 'bg-cortex-success',
    warning: 'bg-cortex-warning',
    at_risk: 'bg-orange-500',
    critical: 'bg-cortex-danger',
    breached: 'bg-cortex-critical',
  }
  return map[slaStatus] || 'bg-cortex-muted'
}

function MyTicketsInner() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('selected') ? Number(searchParams.get('selected')) : null

  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState('')

  const currentTab = STATUS_TABS.find(t => t.key === activeTab)
  const agentEmail = session?.user?.email

  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['my-tickets', activeTab, agentEmail],
    queryFn: () => fetchMyTickets({ ...currentTab.filter, ...(agentEmail ? { assigned_to: agentEmail } : {}) }),
    refetchInterval: 30000,
    enabled: !!agentEmail,
  })

  const tickets = ticketData?.tickets ?? (Array.isArray(ticketData) ? ticketData : [])
  const orgOptions = [...new Set(tickets.map(t => t.company_name || t.company_code).filter(Boolean))].sort()

  const filtered = tickets.filter(t => {
    const matchSearch =
      !search ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toString().includes(search)
    const matchOrg = !orgFilter || t.company_name === orgFilter || t.company_code === orgFilter
    const matchChannel = !currentTab.channelFilter || t.channel === currentTab.channelFilter
    return matchSearch && matchOrg && matchChannel
  })

  const sorted = [...filtered].sort((a, b) => {
    const slaOrder = { critical: 0, at_risk: 1, warning: 2, healthy: 3 }
    const slaA = slaOrder[a.sla_status] ?? 4
    const slaB = slaOrder[b.sla_status] ?? 4
    if (slaA !== slaB) return slaA - slaB
    return (b.sla_consumption_pct || 0) - (a.sla_consumption_pct || 0)
  })

  const selectTicket = (id) => {
    router.replace(`/my-tickets?selected=${id}`, { scroll: false })
  }

  const clearSelection = () => {
    router.replace('/my-tickets', { scroll: false })
  }

  // ── 3-panel layout when a ticket is selected ─────────────────────────
  if (selectedId) {
    return (
      <div className="flex gap-0 h-[calc(100vh-48px)] -m-6 overflow-hidden">

        {/* Left: compact ticket list */}
        <div className="w-72 flex-shrink-0 border-r border-cortex-border bg-cortex-surface flex flex-col">

          {/* List header */}
          <div className="px-3 py-3 border-b border-cortex-border flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cortex-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="input pl-8 text-xs py-1.5 h-7 w-full"
              />
            </div>
            <button
              onClick={clearSelection}
              className="p-1.5 text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised rounded-lg transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-2 py-2 border-b border-cortex-border flex gap-1 flex-wrap">
            {STATUS_TABS.slice(0, 5).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-2 py-1 text-[10px] font-semibold rounded transition-colors',
                  activeTab === tab.key
                    ? 'bg-cortex-accent/15 text-cortex-accent'
                    : 'text-cortex-muted hover:bg-cortex-surface-raised hover:text-cortex-text'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Ticket rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-cortex-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-3 animate-pulse">
                  <div className="h-3 bg-cortex-bg rounded mb-2 w-3/4" />
                  <div className="h-3 bg-cortex-bg rounded w-1/2" />
                </div>
              ))
            ) : sorted.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-cortex-muted">No tickets</div>
            ) : sorted.map(ticket => {
              const isSelected = ticket.id === selectedId
              return (
                <button
                  key={ticket.id}
                  onClick={() => selectTicket(ticket.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 hover:bg-cortex-surface-raised transition-colors flex items-start gap-2.5 group',
                    isSelected ? 'bg-cortex-accent/8 border-l-2 border-l-cortex-accent' : 'border-l-2 border-l-transparent'
                  )}
                >
                  <div className="w-0.5 self-stretch rounded-full bg-cortex-border overflow-hidden flex-shrink-0">
                    <div
                      className={`w-full ${getSLABarColor(ticket.sla_status)}`}
                      style={{ height: `${Math.min(ticket.sla_consumption_pct || 0, 100)}%` }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`badge text-[9px] py-0 ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                      {ticket.channel === 'voice'
                        ? <span className="text-[9px] text-blue-400">📞</span>
                        : <span className="text-[9px] text-cortex-muted">✉</span>
                      }
                      {ticket.escalation_level > 0 && (
                        <AlertTriangle className="w-3 h-3 text-cortex-warning" />
                      )}
                    </div>
                    <p className={cn(
                      'text-xs font-medium line-clamp-2 leading-snug',
                      isSelected ? 'text-cortex-accent' : 'text-cortex-text'
                    )}>
                      {ticket.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-mono ${getSLAStatusColor(ticket.sla_status)}`}>
                        {ticket.sla_consumption_pct != null ? `${Math.round(ticket.sla_consumption_pct)}%` : '—'}
                      </span>
                      <span className="text-[10px] text-cortex-muted">·</span>
                      <span className="text-[10px] text-cortex-muted">{formatRelativeTime(ticket.created_at)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Center: thread */}
        <div className="flex-1 overflow-y-auto p-5 bg-cortex-bg">
          <TicketThread ticketId={selectedId} />
        </div>

        {/* Right: sidebar */}
        <div className="w-72 flex-shrink-0 border-l border-cortex-border bg-cortex-surface overflow-y-auto p-3">
          <TicketSidebar ticketId={selectedId} onTicketUpdated={() => {}} />
        </div>

      </div>
    )
  }

  // ── Full-width list (no selection) ───────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">My Queue</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">My Tickets</h1>
          <p className="text-cortex-muted text-sm mt-0.5">
            {sorted.length} ticket{sorted.length !== 1 ? 's' : ''} · sorted by SLA urgency
          </p>
        </div>
      </div>

      {/* Search + Org filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets by title or ID…"
            className="input pl-9 w-64"
          />
        </div>
        {orgOptions.length > 0 && (
          <div className="relative flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cortex-muted" />
            <select
              value={orgFilter}
              onChange={e => setOrgFilter(e.target.value)}
              className="input pr-8"
            >
              <option value="">All Orgs</option>
              {orgOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              activeTab === tab.key
                ? 'bg-cortex-accent/15 text-cortex-accent'
                : 'text-cortex-muted hover:bg-cortex-surface-raised hover:text-cortex-text'
            )}
          >
            {tab.label}
          </button>
        ))}
        <NewBadge description="Channel filters (new) — the 📞 Voice and ✉ Email tabs filter your tickets by how they came in." />
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="card animate-pulse h-20" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="card text-center py-12">
          <Ticket className="w-8 h-8 text-cortex-muted mx-auto mb-2" />
          <p className="text-cortex-muted text-sm">No tickets found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => selectTicket(ticket.id)}
              className="card w-full text-left flex items-center gap-4 hover:border-cortex-accent/40 transition-colors group"
            >
              {/* SLA bar */}
              <div className="w-1 self-stretch rounded-full shrink-0 bg-cortex-border overflow-hidden">
                <div
                  className={`w-full ${getSLABarColor(ticket.sla_status)} transition-all`}
                  style={{ height: `${Math.min(ticket.sla_consumption_pct || 0, 100)}%` }}
                />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-cortex-muted">#{ticket.id}</span>
                  <span className={`badge ${getPriorityColor(ticket.priority)} text-xs`}>{ticket.priority}</span>
                  {ticket.escalation_level > 0 && (
                    <AlertTriangle className="w-3.5 h-3.5 text-cortex-warning" />
                  )}
                </div>
                <p className="text-sm font-medium text-cortex-text truncate group-hover:text-cortex-accent transition-colors">
                  {ticket.title}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-cortex-muted">
                  <span>{ticket.status}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(ticket.created_at)}
                  </span>
                  {ticket.sla_consumption_pct != null && (
                    <>
                      <span>·</span>
                      <span className={`font-mono ${getSLAStatusColor(ticket.sla_status)}`}>
                        SLA {Math.round(ticket.sla_consumption_pct)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-cortex-muted group-hover:text-cortex-accent transition-colors shrink-0 text-xs">Open →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MyTicketsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-cortex-muted text-sm">Loading…</div>}>
      <MyTicketsInner />
    </Suspense>
  )
}
