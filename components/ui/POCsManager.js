'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Search,
  Building2,
  Ticket,
  Phone,
  Mail,
  X,
  ChevronRight,
  Save,
} from 'lucide-react'
import { getPriorityColor, cn } from '@/lib/utils'

function fetchPOCs(search) {
  const qs = new URLSearchParams()
  if (search) qs.set('search', search)
  return fetch(`/api/admin/pocs?${qs}`).then(r => r.ok ? r.json() : [])
}

function fetchCompanies() {
  return fetch('/api/admin/companies').then(r => r.ok ? r.json() : [])
}

function fetchPOCDetail(id) {
  return fetch(`/api/admin/pocs/${id}`).then(r => r.ok ? r.json() : null)
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??'
}

export default function POCsManager() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const isAdmin = session?.user?.role === 'admin'

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: pocs = [], isLoading } = useQuery({
    queryKey: ['pocs-manager', debouncedSearch],
    queryFn: () => fetchPOCs(debouncedSearch),
    refetchInterval: 60000,
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['all-companies'],
    queryFn: fetchCompanies,
  })

  const { data: selectedPOC, isLoading: loadingPOC } = useQuery({
    queryKey: ['poc-detail', selectedId],
    queryFn: () => fetchPOCDetail(selectedId),
    enabled: !!selectedId,
  })

  // Populate edit form when POC detail loads
  useEffect(() => {
    if (selectedPOC) {
      setEditForm({
        name: selectedPOC.name || '',
        email: selectedPOC.email || '',
        phone: selectedPOC.phone || '',
        role: selectedPOC.role || '',
        company_id: selectedPOC.company_id || '',
        is_primary: selectedPOC.is_primary || false,
        is_vip: selectedPOC.is_vip || false,
        status: selectedPOC.status || 'active',
      })
    }
  }, [selectedPOC])

  async function handleSave() {
    if (!editForm || !selectedId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/pocs/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['pocs-manager'] })
        queryClient.invalidateQueries({ queryKey: ['poc-detail', selectedId] })
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-6 animate-fade-in">

      {/* List panel */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* Header */}
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Directory</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">Customers</h1>
          <p className="text-cortex-muted text-sm mt-0.5">
            {pocs.length} contact{pocs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* NEW feature banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-cortex-accent/8 border border-cortex-accent/20 text-sm">
          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cortex-accent text-white rounded-full uppercase tracking-wide select-none leading-none flex-shrink-0 mt-0.5">NEW</span>
          <div className="text-cortex-muted leading-relaxed">
            <span className="font-semibold text-cortex-text">Customers page</span> — Search and view all contacts, edit their info, and see open tickets. VIP contacts are marked with ⭐. Contacts can be linked to companies and tickets. Available to both admins and agents.
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or company…"
            className="input pl-9 w-full max-w-sm"
          />
        </div>

        {/* POC list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card animate-pulse h-16" />
            ))}
          </div>
        ) : pocs.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-cortex-muted text-sm">No contacts found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pocs.map(poc => (
              <button
                key={poc.id}
                onClick={() => setSelectedId(poc.id === selectedId ? null : poc.id)}
                className={cn(
                  'card w-full text-left flex items-center gap-4 hover:border-cortex-accent/40 transition-colors group',
                  selectedId === poc.id && 'border-cortex-accent/50 bg-cortex-accent/5'
                )}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-lg bg-cortex-accent/15 text-cortex-accent text-xs font-display font-bold flex items-center justify-center flex-shrink-0 select-none">
                  {getInitials(poc.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-semibold text-cortex-text truncate">{poc.name}</span>
                    {poc.is_vip && <span title="VIP customer" className="text-yellow-400 text-sm leading-none">⭐</span>}
                    {poc.is_primary && (
                      <span className="badge text-[10px] px-1.5 py-0 bg-cortex-accent/10 text-cortex-accent">Primary</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-cortex-muted">
                    {poc.company_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{poc.company_name}</span>
                      </span>
                    )}
                    {poc.email && (
                      <span className="flex items-center gap-1 hidden sm:flex">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{poc.email}</span>
                      </span>
                    )}
                    {poc.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {poc.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Trailing */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {poc.open_ticket_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-cortex-warning font-mono tabular-nums">
                      <Ticket className="w-3 h-3" />
                      {poc.open_ticket_count}
                    </span>
                  )}
                  <ChevronRight className={cn(
                    'w-4 h-4 text-cortex-muted transition-all',
                    selectedId === poc.id
                      ? 'text-cortex-accent rotate-90'
                      : 'group-hover:text-cortex-accent'
                  )} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail / edit panel */}
      {selectedId && (
        <div className="w-80 flex-shrink-0 space-y-4 animate-fade-in">

          {/* Edit form */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-bold text-cortex-text">Contact Details</h2>
              <button
                onClick={() => setSelectedId(null)}
                className="text-cortex-muted hover:text-cortex-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingPOC || !editForm ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse h-9 bg-cortex-surface-raised rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-cortex-muted mb-1 block">Full Name</label>
                  <input
                    className="input w-full"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-cortex-muted mb-1 block">Email</label>
                  <input
                    className="input w-full"
                    type="email"
                    value={editForm.email || ''}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-cortex-muted mb-1 block">Phone</label>
                  <input
                    className="input w-full"
                    type="tel"
                    value={editForm.phone || ''}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-cortex-muted mb-1 block">Role / Title</label>
                  <input
                    className="input w-full"
                    value={editForm.role || ''}
                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-cortex-muted mb-1 block">Company</label>
                  <select
                    className="input w-full"
                    value={editForm.company_id || ''}
                    onChange={e => setEditForm(f => ({ ...f, company_id: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-5 pt-1">
                  <label className="flex items-center gap-2 text-sm text-cortex-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_primary}
                      onChange={e => setEditForm(f => ({ ...f, is_primary: e.target.checked }))}
                      className="rounded"
                    />
                    Primary
                  </label>
                  <label className="flex items-center gap-2 text-sm text-cortex-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_vip}
                      onChange={e => setEditForm(f => ({ ...f, is_vip: e.target.checked }))}
                      className="rounded"
                    />
                    VIP ⭐
                  </label>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    'btn-primary w-full flex items-center justify-center gap-2 transition-all',
                    saveSuccess && 'bg-cortex-success border-cortex-success'
                  )}
                >
                  {saving
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Save className="w-4 h-4" />
                  }
                  {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Linked tickets */}
          {selectedPOC?.tickets !== undefined && (
            <div className="card space-y-3">
              <h3 className="text-xs font-semibold text-cortex-muted uppercase tracking-widest">
                Tickets ({selectedPOC.tickets.length})
              </h3>
              {selectedPOC.tickets.length === 0 ? (
                <p className="text-xs text-cortex-muted py-2">No tickets found for this contact.</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {selectedPOC.tickets.map(t => (
                    <Link
                      key={t.id}
                      href={`/tickets/${t.id}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-cortex-surface-raised transition-colors group"
                    >
                      <span className="text-xs font-mono text-cortex-muted w-10 shrink-0">#{t.id}</span>
                      <span className="flex-1 text-xs text-cortex-text truncate group-hover:text-cortex-accent transition-colors">
                        {t.title}
                      </span>
                      <span className={`badge text-[10px] px-1.5 py-0 ${getPriorityColor(t.priority)}`}>
                        {t.priority}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
