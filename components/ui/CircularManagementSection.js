'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Edit, Trash2, History, X, ChevronDown, ChevronUp } from 'lucide-react'
import Modal from './Modal'
import { getCirculars } from '@/lib/api'

export default function CircularManagementSection() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editCircular, setEditCircular] = useState(null)
  const [historyId, setHistoryId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const { data: circulars = [], isLoading } = useQuery({
    queryKey: ['admin-circulars'],
    queryFn: () => getCirculars({ all: 'true' }),
    refetchInterval: 60000,
  })

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

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
      await qc.invalidateQueries({ queryKey: ['admin-circulars'] })
      await qc.invalidateQueries({ queryKey: ['circulars'] })
      showToast(editCircular ? 'Circular updated' : 'Circular published')
      setModalOpen(false)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Archive circular: "${c.title}"?`)) return
    try {
      const res = await fetch(`/api/circulars/${c.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      await qc.invalidateQueries({ queryKey: ['admin-circulars'] })
      await qc.invalidateQueries({ queryKey: ['circulars'] })
      showToast('Circular archived')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const active = circulars.filter(c => c.is_active)
  const archived = circulars.filter(c => !c.is_active)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cortex-success/10 rounded-lg">
            <BookOpen className="w-5 h-5 text-cortex-success" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-cortex-text">Circulars &amp; Knowledge Base</h2>
            <p className="text-xs text-cortex-muted">
              {active.length} active · {archived.length} archived
            </p>
          </div>
        </div>
        <button
          onClick={() => { setEditCircular(null); setModalOpen(true) }}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Circular
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'error' ? 'bg-cortex-danger text-white' : 'bg-cortex-success text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-cortex-surface animate-pulse rounded-lg" />)}</div>
      ) : (
        <div className="space-y-2">
          {circulars.length === 0 && (
            <div className="card text-center py-10 text-cortex-muted text-sm">
              No circulars yet. Create one to brief your agents.
            </div>
          )}
          {circulars.map(c => (
            <div key={c.id} className={`card transition-opacity ${!c.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-cortex-text text-sm">{c.title}</span>
                    {!c.is_active && <span className="badge text-xs text-cortex-muted bg-cortex-border/50">Archived</span>}
                    {c.category && <span className="badge text-xs text-cortex-accent bg-cortex-accent/10">{c.category}</span>}
                    {c.tags?.map(t => (
                      <span key={t} className="badge text-xs text-cortex-muted bg-cortex-border/40">#{t}</span>
                    ))}
                  </div>
                  <p className="text-xs text-cortex-muted mt-1 line-clamp-1">{c.content}</p>
                </div>
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
                      onClick={() => handleDelete(c)}
                      className="p-1.5 text-cortex-muted hover:text-cortex-danger rounded transition-colors"
                      title="Archive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Version history inline */}
              {historyId === c.id && <VersionHistory circularId={c.id} />}
            </div>
          ))}
        </div>
      )}

      <CircularModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
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

  if (isLoading) return <div className="mt-3 text-xs text-cortex-muted animate-pulse">Loading history…</div>
  const versions = data?.versions || []
  if (versions.length === 0) return <div className="mt-3 text-xs text-cortex-muted">No edit history yet.</div>

  return (
    <div className="mt-3 border-t border-cortex-border pt-3 space-y-1">
      <p className="text-xs font-mono text-cortex-muted uppercase tracking-wide mb-2">Edit History</p>
      {versions.map(v => (
        <div key={v.id} className="text-xs flex items-start gap-2 text-cortex-muted">
          <span className="badge text-cortex-muted bg-cortex-border/40 shrink-0">v{v.version}</span>
          <span>
            {v.changed_by_name || 'Unknown'} ·{' '}
            {new Date(v.changed_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}

function CircularModal({ isOpen, onClose, circular, onSave, saving }) {
  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '', is_active: true })

  // Sync form when circular changes
  if (circular && form.title !== circular.title && form._id !== circular.id) {
    setForm({
      _id: circular.id,
      title: circular.title || '',
      content: circular.content || '',
      category: circular.category || '',
      tags: (circular.tags || []).join(', '),
      is_active: circular.is_active !== false,
    })
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={circular ? 'Edit Circular' : 'New Circular'}>
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Title *</label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            className="input w-full"
            required
            placeholder="e.g. System Downtime Notice — 15 Mar"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Content *</label>
          <textarea
            value={form.content}
            onChange={e => set('content', e.target.value)}
            className="input w-full min-h-[120px] resize-y"
            required
            placeholder="Full circular text…"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Category</label>
            <input
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="input w-full"
              placeholder="e.g. Policy, Technical"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tags (comma-separated)</label>
            <input
              value={form.tags}
              onChange={e => set('tags', e.target.value)}
              className="input w-full"
              placeholder="urgent, billing, sla"
            />
          </div>
        </div>
        {circular && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="rounded"
            />
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
