'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { BookOpen, Search, Plus, Edit, Trash2, History, Tag, ChevronDown, ChevronUp } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { formatRelativeTime } from '@/lib/utils'

export default function KnowledgeBasePage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const isAdmin = session?.user?.role === 'admin'
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [editCircular, setEditCircular] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [historyId, setHistoryId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const { data: circulars = [], isLoading } = useQuery({
    queryKey: ['kb-circulars', isAdmin],
    queryFn: () => fetch(isAdmin ? '/api/circulars?all=true' : '/api/circulars').then(r => r.ok ? r.json() : []),
    refetchInterval: 60000,
  })

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Collect unique categories
  const categories = ['all', ...new Set(circulars.map(c => c.category).filter(Boolean))]

  // Filter circulars
  const filtered = circulars.filter(c => {
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase()) ||
      c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchCategory = activeCategory === 'all' || c.category === activeCategory
    return matchSearch && matchCategory
  })

  async function handleSave(form) {
    setSaving(true)
    try {
      const url = editCircular ? `/api/circulars/${editCircular.id}` : '/api/circulars'
      const method = editCircular ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      await qc.invalidateQueries({ queryKey: ['kb-circulars'] })
      await qc.invalidateQueries({ queryKey: ['circulars'] })
      showToast(editCircular ? 'Circular updated' : 'Circular published')
      setModalOpen(false)
      setEditCircular(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(c) {
    if (!confirm(`Archive "${c.title}"?`)) return
    try {
      await fetch(`/api/circulars/${c.id}`, { method: 'DELETE' })
      await qc.invalidateQueries({ queryKey: ['kb-circulars'] })
      showToast('Circular archived')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Reference</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">Knowledge Base</h1>
          <p className="text-cortex-muted text-sm mt-0.5">
            {filtered.length} circular{filtered.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditCircular(null); setModalOpen(true) }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> New Circular
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'error' ? 'bg-cortex-danger text-white' : 'bg-cortex-success text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search circulars, topics, tags…"
          className="input w-full pl-9"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
              activeCategory === cat
                ? 'bg-cortex-accent/15 text-cortex-accent'
                : 'text-cortex-muted hover:bg-cortex-surface-raised hover:text-cortex-text'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Circular list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <BookOpen className="w-8 h-8 text-cortex-muted mx-auto mb-2" />
          <p className="text-cortex-muted text-sm">
            {search ? `No circulars matching "${search}"` : 'No circulars published yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div
              key={c.id}
              className={`card transition-all ${!c.is_active ? 'opacity-60 border-dashed' : 'hover:border-cortex-accent/30'}`}
            >
              {/* Circular header */}
              <div className="flex items-start gap-3">
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-cortex-text">{c.title}</span>
                    {!c.is_active && <span className="badge text-xs text-cortex-muted bg-cortex-border/50">Archived</span>}
                    {c.category && (
                      <span className="badge text-xs text-cortex-accent bg-cortex-accent/10">{c.category}</span>
                    )}
                    {c.tags?.map(t => (
                      <span key={t} className="badge text-xs text-cortex-muted bg-cortex-border/40 flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />#{t}
                      </span>
                    ))}
                  </div>
                  <p className={`text-sm text-cortex-muted ${expandedId !== c.id ? 'line-clamp-2' : ''}`}>
                    {c.content}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-cortex-muted">
                    <span>{c.created_by_name || 'System'}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(c.updated_at || c.created_at)}</span>
                  </div>
                </button>

                {/* Admin actions */}
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setHistoryId(historyId === c.id ? null : c.id)}
                      className="p-1.5 text-cortex-muted hover:text-cortex-accent rounded transition-colors"
                      title="Version history"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setEditCircular(c); setModalOpen(true) }}
                      className="p-1.5 text-cortex-muted hover:text-cortex-accent rounded transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {c.is_active && (
                      <button
                        onClick={() => handleArchive(c)}
                        className="p-1.5 text-cortex-muted hover:text-cortex-danger rounded transition-colors"
                        title="Archive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  className="p-1.5 text-cortex-muted shrink-0"
                >
                  {expandedId === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Version history */}
              {historyId === c.id && <VersionHistory circularId={c.id} />}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <CircularModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditCircular(null) }}
        circular={editCircular}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}

function VersionHistory({ circularId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['circular-history', circularId],
    queryFn: () => fetch(`/api/circulars/${circularId}`).then(r => r.json()),
  })
  if (isLoading) return <div className="mt-3 text-xs text-cortex-muted animate-pulse pt-3 border-t border-cortex-border">Loading history…</div>
  const versions = data?.versions || []
  if (versions.length === 0) return <div className="mt-3 pt-3 border-t border-cortex-border text-xs text-cortex-muted">No edit history yet.</div>

  return (
    <div className="mt-3 pt-3 border-t border-cortex-border space-y-1.5">
      <p className="text-xs font-mono text-cortex-muted uppercase tracking-wide">Edit History</p>
      {versions.map(v => (
        <div key={v.id} className="text-xs flex items-center gap-2 text-cortex-muted">
          <span className="badge text-cortex-muted bg-cortex-border/40 shrink-0">v{v.version}</span>
          <span>{v.changed_by_name || 'Unknown'} · {new Date(v.changed_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
        </div>
      ))}
    </div>
  )
}

function CircularModal({ isOpen, onClose, circular, onSave, saving }) {
  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '', is_active: true })
  const [synced, setSynced] = useState(false)

  if (isOpen && !synced) {
    setForm({
      title: circular?.title || '',
      content: circular?.content || '',
      category: circular?.category || '',
      tags: (circular?.tags || []).join(', '),
      is_active: circular?.is_active !== false,
    })
    setSynced(true)
  }
  if (!isOpen && synced) setSynced(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={circular ? 'Edit Circular' : 'New Circular'}>
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Content *</label>
          <textarea value={form.content} onChange={e => set('content', e.target.value)} className="input w-full min-h-[150px] resize-y" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>
            <input value={form.category} onChange={e => set('category', e.target.value)} className="input w-full" placeholder="Policy, Technical…" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tags</label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} className="input w-full" placeholder="urgent, billing" />
          </div>
        </div>
        {circular && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
            Active (visible to agents)
          </label>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : circular ? 'Update' : 'Publish'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
