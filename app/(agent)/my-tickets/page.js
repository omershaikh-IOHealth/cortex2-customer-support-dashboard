'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Ticket,
  Clock,
  AlertTriangle,
  Search,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { getSLAStatusColor, getPriorityColor, formatRelativeTime, cn } from '@/lib/utils'

const STATUS_TABS = [
  { key: 'all',         label: 'All',         filter: {} },
  { key: 'open',        label: 'Open',        filter: { status: 'Open' } },
  { key: 'in_progress', label: 'In Progress', filter: { status: 'In Progress' } },
  { key: 'waiting',     label: 'Waiting',     filter: { status: 'Waiting' } },
  { key: 'resolved',    label: 'Resolved',    filter: { status: 'complete' } },
]

function fetchMyTickets(params = {}) {
  const qs = new URLSearchParams({ limit: '100', ...params }).toString()
  return fetch(`/api/tickets?${qs}`).then(r => r.ok ? r.json() : { tickets: [], total: 0 })
}

export default function MyTicketsPage() {
  const { data: session } = useSession()
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

  // Collect unique orgs/companies from tickets for filter dropdown
  const orgOptions = [...new Set(tickets.map(t => t.company_name || t.company_code).filter(Boolean))].sort()

  const filtered = tickets.filter(t => {
    const matchSearch =
      !search ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toString().includes(search)
    const matchOrg =
      !orgFilter ||
      t.company_name === orgFilter ||
      t.company_code === orgFilter
    return matchSearch && matchOrg
  })

  // Sort by SLA consumption (highest first) — critical tickets to top
  const sorted = [...filtered].sort((a, b) => {
    const slaOrder = { critical: 0, at_risk: 1, warning: 2, healthy: 3 }
    const slaA = slaOrder[a.sla_status] ?? 4
    const slaB = slaOrder[b.sla_status] ?? 4
    if (slaA !== slaB) return slaA - slaB
    return (b.sla_consumption_pct || 0) - (a.sla_consumption_pct || 0)
  })

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-cortex-text">My Tickets</h1>
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
      <div className="flex gap-1 border-b border-cortex-border">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-cortex-accent text-cortex-accent'
                : 'border-transparent text-cortex-muted hover:text-cortex-text'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse h-20" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="card text-center py-12">
          <Ticket className="w-8 h-8 text-cortex-muted mx-auto mb-2" />
          <p className="text-cortex-muted text-sm">No tickets found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(ticket => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="card flex items-center gap-4 hover:border-cortex-accent/40 transition-colors group"
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
                  <span className={`badge ${getPriorityColor(ticket.priority)} text-xs`}>
                    {ticket.priority}
                  </span>
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

              <ChevronRight className="w-4 h-4 text-cortex-muted shrink-0 group-hover:text-cortex-accent transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
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
