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
  UserPlus,
} from 'lucide-react'
import { getPriorityColor, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

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

  // Add customer (Item 25)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phoneNumber: '', countryCode: '+971', email: '', company_id: '' })
  const [addSaving, setAddSaving] = useState(false)

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

  async function handleAddCustomer(e) {
    e.preventDefault()
    if (!addForm.name.trim()) return
    setAddSaving(true)
    try {
      let phone = addForm.phoneNumber.trim()
      if (phone) {
        if (addForm.countryCode === '+971' && phone.startsWith('0')) {
          phone = '00971' + phone.slice(1)
        } else {
          phone = addForm.countryCode.replace('+', '00') + phone
        }
      }
      const res = await fetch('/api/admin/pocs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          phone: phone || undefined,
          email: addForm.email.trim() || undefined,
          company_id: addForm.company_id || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to add customer')
      toast.success('Customer added')
      setShowAddModal(false)
      setAddForm({ name: '', phoneNumber: '', countryCode: '+971', email: '', company_id: '' })
      queryClient.invalidateQueries({ queryKey: ['pocs-manager'] })
    } catch (err) {
      toast.error(err.message || 'Failed to add customer')
    } finally {
      setAddSaving(false)
    }
  }

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

        {/* Search + Add */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, or company…"
              className="input pl-9 w-full"
            />
          </div>
          <button
            onClick={() => { setAddForm({ name: '', phoneNumber: '', countryCode: '+971', email: '', company_id: '' }); setShowAddModal(true) }}
            className="btn-primary flex items-center gap-1.5 text-sm whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" /> Add Customer
          </button>
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

      {/* Add Customer modal (Item 25) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cortex-surface border border-cortex-border rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-cortex-border">
              <h2 className="font-display font-bold text-cortex-text text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cortex-accent" /> Add Customer
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-cortex-surface-raised rounded-lg text-cortex-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Name *</label>
                <input required value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  className="input w-full" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Phone</label>
                <div className="flex gap-2">
                  <select value={addForm.countryCode}
                    onChange={e => setAddForm(f => ({ ...f, countryCode: e.target.value }))}
                    className="input w-28 flex-shrink-0 text-xs">
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+974">🇶🇦 +974</option>
                    <option value="+965">🇰🇼 +965</option>
                    <option value="+973">🇧🇭 +973</option>
                    <option value="+968">🇴🇲 +968</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                  </select>
                  <input type="tel" value={addForm.phoneNumber}
                    onChange={e => setAddForm(f => ({ ...f, phoneNumber: e.target.value }))}
                    className="input flex-1" placeholder="501234567" />
                </div>
                {addForm.countryCode === '+971' && addForm.phoneNumber.startsWith('0') && (
                  <p className="text-[10px] text-cortex-accent mt-1">Will be saved as 00971{addForm.phoneNumber.slice(1)}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  className="input w-full" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Company</label>
                <select value={addForm.company_id}
                  onChange={e => setAddForm(f => ({ ...f, company_id: e.target.value }))}
                  className="input w-full">
                  <option value="">— None —</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={addSaving} className="btn-primary flex-1 disabled:opacity-40">
                  {addSaving ? 'Adding…' : 'Add Customer'}
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary px-5">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

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

                <div>
                  <label className="text-xs text-cortex-muted mb-1 block">Contact Type</label>
                  <select
                    className="input w-full"
                    value={editForm.is_vip ? 'vip' : editForm.is_primary ? 'primary' : 'none'}
                    onChange={e => setEditForm(f => ({
                      ...f,
                      is_primary: e.target.value === 'primary',
                      is_vip: e.target.value === 'vip',
                    }))}
                  >
                    <option value="none">— None —</option>
                    <option value="primary">Primary</option>
                    <option value="vip">VIP ⭐</option>
                  </select>
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
                      href={isAdmin ? `/tickets/${t.id}` : `/my-tickets?selected=${t.id}`}
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
