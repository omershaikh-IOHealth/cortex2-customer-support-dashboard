'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  BookOpen, Search, Plus, Edit, Trash2, History, Tag,
  CheckCircle, ChevronRight, Eye, Code2, X,
  FileText, AlertTriangle, HelpCircle, ArrowUpRight, Volume2,
  Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { cn, formatRelativeTime } from '@/lib/utils'
import { getCircularAcks, acknowledgeCirculars } from '@/lib/api'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  policy:           { label: 'Policies',       dot: 'bg-blue-400',    icon: FileText },
  troubleshooting:  { label: 'Troubleshooting', dot: 'bg-orange-400',  icon: AlertTriangle },
  faq:              { label: 'FAQs',            dot: 'bg-teal-400',    icon: HelpCircle },
  escalation:       { label: 'Escalation',      dot: 'bg-cortex-danger', icon: ArrowUpRight },
  script:           { label: 'Scripts',         dot: 'bg-purple-400',  icon: Volume2 },
  announcement:     { label: 'Announcements',   dot: 'bg-cortex-warning', icon: FileText },
}

function getCategoryConfig(cat) {
  if (!cat) return { label: 'General', dot: 'bg-cortex-muted', icon: FileText }
  const key = (cat || '').toLowerCase().replace(/\s+/g, '')
  return CATEGORY_CONFIG[key] || { label: cat, dot: 'bg-cortex-accent', icon: FileText }
}

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-cortex-text mt-4 mb-1.5">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-cortex-text mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-cortex-text mt-5 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-cortex-text">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-cortex-text">$1</li>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-cortex-surface-raised text-cortex-accent font-mono text-xs">$1</code>')
    .replace(/\n\n/g, '</p><p class="text-cortex-muted text-sm mb-3">')
    .replace(/\n/g, '<br/>')
}

// ─── Markdown toolbar ─────────────────────────────────────────────────────────

function MarkdownToolbar({ textareaRef, value, onChange }) {
  function wrap(before, after = before, defaultText = 'text') {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || defaultText
    const newVal = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(newVal)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    }, 0)
  }

  function prependLine(prefix) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const newVal = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(newVal)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, start + prefix.length) }, 0)
  }

  const tools = [
    { icon: Heading1, label: 'H1', action: () => prependLine('# ') },
    { icon: Heading2, label: 'H2', action: () => prependLine('## ') },
    { icon: Heading3, label: 'H3', action: () => prependLine('### ') },
    { icon: Bold,     label: 'Bold',   action: () => wrap('**', '**', 'bold text') },
    { icon: Italic,   label: 'Italic', action: () => wrap('*', '*', 'italic text') },
    { icon: List,        label: 'Bullets',  action: () => prependLine('- ') },
    { icon: ListOrdered, label: 'Numbered', action: () => prependLine('1. ') },
  ]

  return (
    <div className="flex items-center gap-0.5 p-1 border-b border-cortex-border bg-cortex-bg flex-wrap">
      {tools.map(({ icon: Icon, label, action }) => (
        <button
          key={label}
          type="button"
          onClick={action}
          title={label}
          className="p-1.5 rounded text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised transition-colors text-xs font-mono font-bold"
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const isAdmin = session?.user?.role === 'admin'

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editCircular, setEditCircular] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: circulars = [], isLoading } = useQuery({
    queryKey: ['kb-circulars', isAdmin],
    queryFn: () => fetch(isAdmin ? '/api/circulars?all=true' : '/api/circulars').then(r => r.ok ? r.json() : []),
    refetchInterval: 60000,
  })

  const { data: circularAcks } = useQuery({
    queryKey: ['circular-acks'],
    queryFn: getCircularAcks,
    refetchInterval: 300000,
  })
  const ackedIds = new Set(Object.keys(circularAcks || {}).map(Number))

  async function handleAck(id) {
    try {
      await acknowledgeCirculars([id])
      qc.invalidateQueries({ queryKey: ['circular-acks'] })
    } catch { /* ignore */ }
  }

  // Category list with counts
  const allCategories = ['all', ...new Set(circulars.map(c => (c.category || '').toLowerCase()).filter(Boolean))]
  const catCounts = {}
  circulars.forEach(c => {
    const k = (c.category || '').toLowerCase() || 'general'
    catCounts[k] = (catCounts[k] || 0) + 1
  })

  const filtered = circulars.filter(c => {
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase()) ||
      c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchCat = activeCategory === 'all' || (c.category || '').toLowerCase() === activeCategory
    return matchSearch && matchCat
  })

  const selectedArticle = circulars.find(c => c.id === selectedId)

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
      setModalOpen(false)
      setEditCircular(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(c) {
    if (!confirm(`Archive "${c.title}"?`)) return
    try {
      await fetch(`/api/circulars/${c.id}`, { method: 'DELETE' })
      await qc.invalidateQueries({ queryKey: ['kb-circulars'] })
      if (selectedId === c.id) setSelectedId(null)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <p className="text-xs font-mono text-cortex-muted uppercase tracking-widest mb-1">Reference</p>
          <h1 className="text-3xl font-display font-bold text-cortex-text">Knowledge Base</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditCircular(null); setModalOpen(true) }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> New Article
          </button>
        )}
      </div>

      {/* 3-column layout */}
      <div className="flex gap-0 h-[calc(100vh-148px)] rounded-xl border border-cortex-border overflow-hidden bg-cortex-surface">

        {/* ── Left nav (categories) ──────────────────────────────────── */}
        <div className="w-48 flex-shrink-0 border-r border-cortex-border flex flex-col bg-cortex-surface">
          <div className="p-3 border-b border-cortex-border">
            <p className="text-[10px] font-mono text-cortex-muted uppercase tracking-widest">Categories</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {allCategories.map(cat => {
              const cfg = cat === 'all' ? { label: 'All Articles', dot: 'bg-cortex-muted', icon: BookOpen } : getCategoryConfig(cat)
              const Icon = cfg.icon
              const count = cat === 'all' ? circulars.length : (catCounts[cat] || 0)
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                    activeCategory === cat
                      ? 'bg-cortex-accent/10 text-cortex-accent'
                      : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
                  <span className="flex-1 capitalize">{cfg.label}</span>
                  <span className={cn('text-[10px] font-mono', activeCategory === cat ? 'text-cortex-accent' : 'text-cortex-muted')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Center: article list ───────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-cortex-border flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-cortex-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cortex-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search articles…"
                className="input pl-8 text-xs py-1.5 w-full h-8"
              />
            </div>
          </div>

          {/* Article count */}
          <div className="px-3 py-2 border-b border-cortex-border">
            <p className="text-[10px] font-mono text-cortex-muted uppercase tracking-widest">
              {filtered.length} article{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Article list */}
          <div className="flex-1 overflow-y-auto divide-y divide-cortex-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 animate-pulse">
                  <div className="h-3 bg-cortex-bg rounded mb-2 w-3/4" />
                  <div className="h-3 bg-cortex-bg rounded w-1/2" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-cortex-muted">
                {search ? `No results for "${search}"` : 'No articles in this category'}
              </div>
            ) : filtered.map(c => {
              const cfg = getCategoryConfig(c.category)
              const isSelected = c.id === selectedId
              const isAcked = ackedIds.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setIsEditing(false); setShowHistory(false) }}
                  className={cn(
                    'w-full text-left p-3 border-l-2 hover:bg-cortex-surface-raised transition-colors',
                    isSelected ? 'bg-cortex-accent/5 border-l-cortex-accent' : 'border-l-transparent'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5', cfg.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {c.category && (
                          <span className="text-[9px] uppercase font-semibold tracking-wide text-cortex-muted">{c.category}</span>
                        )}
                        {isAcked && <CheckCircle className="w-3 h-3 text-cortex-success flex-shrink-0" />}
                        {!c.is_active && <span className="text-[9px] text-cortex-muted">(archived)</span>}
                      </div>
                      <p className={cn('text-xs font-medium line-clamp-2 leading-snug', isSelected ? 'text-cortex-accent' : 'text-cortex-text')}>
                        {c.title}
                      </p>
                      <p className="text-[10px] text-cortex-muted mt-1 line-clamp-1">{c.content?.slice(0, 80)}</p>
                    </div>
                    <ChevronRight className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-colors', isSelected ? 'text-cortex-accent' : 'text-cortex-muted')} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right: article detail ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {!selectedArticle ? (
            <div className="flex-1 flex flex-col items-center justify-center text-cortex-muted p-8">
              <div className="w-16 h-16 rounded-2xl bg-cortex-surface-raised flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 opacity-30" />
              </div>
              <p className="text-sm font-medium text-cortex-text mb-1">Select an article</p>
              <p className="text-xs text-center max-w-48">Click any article on the left to view its contents here.</p>
            </div>
          ) : (
            <ArticleView
              article={selectedArticle}
              isAdmin={isAdmin}
              isAcked={ackedIds.has(selectedArticle.id)}
              onAck={() => handleAck(selectedArticle.id)}
              onEdit={() => { setEditCircular(selectedArticle); setModalOpen(true) }}
              onArchive={() => handleArchive(selectedArticle)}
              showHistory={showHistory}
              onToggleHistory={() => setShowHistory(h => !h)}
            />
          )}
        </div>
      </div>

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

// ─── Article detail view ──────────────────────────────────────────────────────

function ArticleView({ article, isAdmin, isAcked, onAck, onEdit, onArchive, showHistory, onToggleHistory }) {
  const cfg = getCategoryConfig(article.category)

  return (
    <div className="flex flex-col h-full">
      {/* Article header */}
      <div className="p-5 border-b border-cortex-border bg-cortex-surface">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cortex-surface-raised', cfg.dot.replace('bg-', 'text-'))}>
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                {cfg.label}
              </span>
              {!article.is_active && (
                <span className="badge bg-cortex-border/50 text-cortex-muted text-[10px]">Archived</span>
              )}
              {article.tags?.map(t => (
                <span key={t} className="badge text-[9px] text-cortex-muted bg-cortex-border/40 flex items-center gap-0.5">
                  <Tag className="w-2.5 h-2.5" />#{t}
                </span>
              ))}
            </div>
            <h2 className="text-lg font-display font-bold text-cortex-text leading-snug">{article.title}</h2>
            <p className="text-xs text-cortex-muted mt-1">
              By {article.created_by_name || 'System'} · {formatRelativeTime(article.updated_at || article.created_at)}
            </p>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {article.is_active && (
              <button
                onClick={onAck}
                disabled={isAcked}
                title={isAcked ? 'Already acknowledged' : 'Mark as read'}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isAcked
                    ? 'bg-cortex-success/10 text-cortex-success cursor-default'
                    : 'bg-cortex-surface-raised text-cortex-muted hover:text-cortex-success hover:bg-cortex-success/10'
                )}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {isAcked ? 'Acknowledged' : 'Acknowledge'}
              </button>
            )}
            {isAdmin && (
              <>
                <button onClick={onToggleHistory} title="Version history" className={cn('p-2 rounded-lg transition-colors', showHistory ? 'bg-cortex-accent/10 text-cortex-accent' : 'text-cortex-muted hover:text-cortex-accent hover:bg-cortex-surface-raised')}>
                  <History className="w-4 h-4" />
                </button>
                <button onClick={onEdit} title="Edit" className="p-2 text-cortex-muted hover:text-cortex-accent hover:bg-cortex-surface-raised rounded-lg transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                {article.is_active && (
                  <button onClick={onArchive} title="Archive" className="p-2 text-cortex-muted hover:text-cortex-danger hover:bg-cortex-danger/5 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Version history inline */}
      {showHistory && (
        <div className="border-b border-cortex-border bg-cortex-bg px-5 py-3">
          <VersionHistory circularId={article.id} />
        </div>
      )}

      {/* Article content (rendered markdown) */}
      <div className="flex-1 overflow-y-auto p-5">
        <div
          className="prose prose-sm max-w-none text-cortex-text space-y-2"
          dangerouslySetInnerHTML={{ __html: `<p class="text-cortex-muted text-sm mb-3">${renderMarkdown(article.content)}</p>` }}
        />
      </div>
    </div>
  )
}

// ─── Version history ──────────────────────────────────────────────────────────

function VersionHistory({ circularId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['circular-history', circularId],
    queryFn: () => fetch(`/api/circulars/${circularId}`).then(r => r.json()),
  })
  if (isLoading) return <p className="text-xs text-cortex-muted animate-pulse">Loading history…</p>
  const versions = data?.versions || []
  if (versions.length === 0) return <p className="text-xs text-cortex-muted">No edit history yet.</p>
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono text-cortex-muted uppercase tracking-wide mb-2">Edit History</p>
      {versions.map(v => (
        <div key={v.id} className="text-xs flex items-center gap-2 text-cortex-muted">
          <span className="badge text-cortex-muted bg-cortex-border/40 shrink-0">v{v.version}</span>
          <span>{v.changed_by_name || 'Unknown'} · {new Date(v.changed_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Create/Edit modal with markdown editor ───────────────────────────────────

function CircularModal({ isOpen, onClose, circular, onSave, saving }) {
  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '', is_active: true })
  const [synced, setSynced] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const textareaRef = useRef(null)

  if (isOpen && !synced) {
    setForm({
      title:     circular?.title    || '',
      content:   circular?.content  || '',
      category:  circular?.category || '',
      tags:      (circular?.tags || []).join(', '),
      is_active: circular?.is_active !== false,
    })
    setSynced(true)
    setPreviewMode(false)
  }
  if (!isOpen && synced) setSynced(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={circular ? 'Edit Article' : 'New Article'}>
      <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">

        <div>
          <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} className="input w-full" required placeholder="Article title…" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Category</label>
            <input value={form.category} onChange={e => set('category', e.target.value)} className="input w-full" placeholder="policy, faq, script…" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">Tags</label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} className="input w-full" placeholder="urgent, billing" />
          </div>
        </div>

        {/* Content with markdown toolbar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-cortex-muted uppercase tracking-wider">Content *</label>
            <button
              type="button"
              onClick={() => setPreviewMode(m => !m)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                previewMode
                  ? 'bg-cortex-accent/15 text-cortex-accent'
                  : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface-raised'
              )}
            >
              {previewMode ? <><Code2 className="w-3.5 h-3.5" /> Edit</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
            </button>
          </div>

          {previewMode ? (
            <div
              className="border border-cortex-border rounded-xl p-4 min-h-[200px] text-sm bg-cortex-bg prose prose-sm max-w-none overflow-auto"
              dangerouslySetInnerHTML={{ __html: form.content
                ? `<p class="text-cortex-muted text-sm mb-3">${renderMarkdown(form.content)}</p>`
                : '<p class="text-cortex-muted text-xs italic">Nothing to preview yet…</p>'
              }}
            />
          ) : (
            <div className="border border-cortex-border rounded-xl overflow-hidden">
              <MarkdownToolbar
                textareaRef={textareaRef}
                value={form.content}
                onChange={v => set('content', v)}
              />
              <textarea
                ref={textareaRef}
                value={form.content}
                onChange={e => set('content', e.target.value)}
                className="w-full px-4 py-3 bg-transparent text-cortex-text text-sm font-mono resize-y min-h-[200px] outline-none placeholder:text-cortex-muted"
                placeholder="Write content in markdown…&#10;&#10;## Section heading&#10;&#10;**Bold text** and *italic text*&#10;&#10;- Bullet point&#10;1. Numbered item"
                required
              />
            </div>
          )}
          <p className="text-[10px] text-cortex-muted mt-1">Supports **bold**, *italic*, ## headings, - bullets, 1. numbered lists</p>
        </div>

        {circular && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
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
