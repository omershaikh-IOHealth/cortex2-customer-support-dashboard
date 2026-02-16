'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTickets } from '@/lib/api'
import Link from 'next/link'
import { 
  getSLAStatusColor, 
  getPriorityColor, 
  getStatusColor,
  formatRelativeTime,
  truncate,
  getSentimentEmoji 
} from '@/lib/utils'
import { Search, Filter, ExternalLink } from 'lucide-react'

export default function TicketsPage() {
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    sla_status: '',
  })
  const [searchTerm, setSearchTerm] = useState('')

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => getTickets(filters),
    refetchInterval: 30000,
  })

  const filteredTickets = tickets?.filter(ticket => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      ticket.title?.toLowerCase().includes(term) ||
      ticket.clickup_task_id?.toLowerCase().includes(term) ||
      ticket.poc_name?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold mb-2">Tickets</h1>
          <p className="text-cortex-muted">Manage and monitor support tickets</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cortex-muted" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full pl-10"
            />
          </div>
          
          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="input"
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 - Critical</option>
            <option value="P2">P2 - High</option>
            <option value="P3">P3 - Medium</option>
            <option value="P4">P4 - Low</option>
            <option value="P5">P5 - Very Low</option>
          </select>

          <select
            value={filters.sla_status}
            onChange={(e) => setFilters({ ...filters, sla_status: e.target.value })}
            className="input"
          >
            <option value="">All SLA Status</option>
            <option value="critical">Critical</option>
            <option value="at_risk">At Risk</option>
            <option value="warning">Warning</option>
            <option value="healthy">Healthy</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in progress">In Progress</option>
            <option value="on hold">On Hold</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cortex-bg">
              <tr>
                <th className="table-header text-left">Ticket</th>
                <th className="table-header">Priority</th>
                <th className="table-header">SLA</th>
                <th className="table-header">Status</th>
                <th className="table-header">Reporter</th>
                <th className="table-header">Created</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cortex-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell" colSpan="7">
                      <div className="h-16 bg-cortex-bg animate-pulse rounded"></div>
                    </td>
                  </tr>
                ))
              ) : filteredTickets && filteredTickets.length > 0 ? (
                filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-cortex-bg/50 transition-colors">
                    <td className="table-cell">
                      <Link href={`/tickets/${ticket.id}`} className="block group">
                        <div className="flex items-start gap-3">
                          {ticket.ai_sentiment && (
                            <span className="text-xl">
                              {getSentimentEmoji(ticket.ai_sentiment)}
                            </span>
                          )}
                          <div>
                            <h3 className="font-semibold group-hover:text-cortex-accent transition-colors mb-1">
                              {truncate(ticket.title, 60)}
                            </h3>
                            <p className="text-xs text-cortex-muted font-mono">
                              {ticket.clickup_task_id?.substring(0, 12)}
                            </p>
                            {ticket.module && (
                              <span className="text-xs text-cortex-muted">
                                {ticket.module}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="table-cell text-center">
                      <span className={`badge ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`badge ${getSLAStatusColor(ticket.sla_status)}`}>
                          {ticket.sla_status}
                        </span>
                        {ticket.sla_consumption_pct !== null && (
                          <span className="text-xs font-mono text-cortex-muted">
                            {ticket.sla_consumption_pct}%
                          </span>
                        )}
                        {ticket.escalation_level > 0 && (
                          <span className="badge bg-cortex-danger/10 text-cortex-danger text-xs">
                            ESC L{ticket.escalation_level}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-center">
                      <span className={`badge ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="text-sm">
                        <p className="font-medium">{ticket.created_by_name || 'Unknown'}</p>
                        <p className="text-xs text-cortex-muted">{ticket.poc_email}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-cortex-muted">
                        {formatRelativeTime(ticket.created_at)}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="btn-secondary text-xs px-3 py-1"
                        >
                          View
                        </Link>
                        {ticket.clickup_url && (
                          <a
                            href={ticket.clickup_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-cortex-border rounded transition-colors"
                            title="Open in ClickUp"
                          >
                            <ExternalLink className="w-4 h-4 text-cortex-muted" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="table-cell text-center py-12 text-cortex-muted">
                    No tickets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {filteredTickets && (
        <div className="text-sm text-cortex-muted text-center">
          Showing {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
