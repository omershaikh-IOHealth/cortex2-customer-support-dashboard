'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTicket, addTicketNote } from '@/lib/api'
import { formatDate, formatRelativeTime, getSentimentEmoji } from '@/lib/utils'
import { StickyNote, MessageSquare, Plus, AlignLeft, Sparkles, History, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

function Section({ title, icon: Icon, iconClass, badge, defaultOpen = true, className, headerRight, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`rounded-2xl border overflow-hidden ${className || 'border-cortex-border bg-cortex-surface'}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-cortex-surface-raised transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${iconClass || 'text-cortex-muted'}`} />}
          <span className="text-sm font-semibold text-cortex-text">{title}</span>
          {badge != null && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cortex-bg border border-cortex-border text-cortex-muted">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {headerRight && (
            <div onClick={e => e.stopPropagation()} className="flex items-center gap-2">
              {headerRight}
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-cortex-muted transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-cortex-border/40 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default function TicketThread({ ticketId }) {
  const queryClient = useQueryClient()
  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [showAllNotes, setShowAllNotes] = useState(false)
  const [threadExpanded, setThreadExpanded] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    refetchInterval: 30000,
    enabled: !!ticketId,
  })

  const handleAddNote = async () => {
    if (!noteContent.trim()) return
    setAddingNote(true)
    try {
      await addTicketNote(ticketId, { content: noteContent })
      setNoteContent('')
      setShowNoteForm(false)
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Note added')
    } catch (e) {
      toast.error(e.message || 'Failed to add note')
    } finally {
      setAddingNote(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-cortex-bg animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  const { ticket, threads } = data
  const internalNotes = (threads || []).filter(t => t.action_type === 'internal_note')
  const publicThreads = (threads || []).filter(t => t.action_type !== 'internal_note')
  const visibleNotes = showAllNotes ? internalNotes : internalNotes.slice(0, 3)
  const hiddenNotes = internalNotes.length - 3

  return (
    <div className="space-y-4">
      {/* Ticket title in panel */}
      <div className="px-1 pb-1 border-b border-cortex-border">
        <h2 className="text-sm font-semibold text-cortex-text line-clamp-2">{ticket.title}</h2>
        {ticket.created_by_name && (
          <p className="text-xs text-cortex-muted mt-0.5">{ticket.created_by_name}</p>
        )}
      </div>

      {/* Description */}
      {ticket.description && (
        <Section title="Description" icon={AlignLeft} defaultOpen>
          <p className="text-sm text-cortex-muted whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
        </Section>
      )}

      {/* AI Analysis */}
      {ticket.ai_summary && (
        <Section
          title="AI Analysis"
          icon={Sparkles}
          iconClass="text-cortex-accent"
          className="border-cortex-accent/20 bg-cortex-accent/[0.025]"
          defaultOpen
        >
          <p className="text-sm text-cortex-text leading-relaxed">{ticket.ai_summary}</p>
        </Section>
      )}

      {/* Internal Notes */}
      <Section
        title="Internal Notes"
        icon={StickyNote}
        iconClass="text-amber-500"
        badge={internalNotes.length > 0 ? internalNotes.length : undefined}
        className="border-amber-500/20 bg-amber-500/[0.03]"
        defaultOpen
        headerRight={
          <button
            onClick={() => setShowNoteForm(v => !v)}
            className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
          >
            <Plus className="w-3 h-3" /> Add note
          </button>
        }
      >
        {showNoteForm && (
          <div className="mb-4 space-y-2">
            <textarea
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              placeholder="Write an internal note…"
              className="input w-full min-h-[70px] resize-y text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddNote}
                disabled={addingNote || !noteContent.trim()}
                className="btn-primary text-xs py-1.5 px-3"
              >
                {addingNote ? 'Saving…' : 'Save Note'}
              </button>
              <button onClick={() => setShowNoteForm(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
            </div>
          </div>
        )}

        {internalNotes.length === 0 && !showNoteForm ? (
          <p className="text-xs text-cortex-muted text-center py-3">No internal notes yet</p>
        ) : (
          <div className="space-y-3">
            {visibleNotes.map(note => (
              <div key={note.id} className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{note.actor_name}</span>
                  <span className="text-[10px] text-cortex-muted font-mono">{formatDate(note.created_at)}</span>
                </div>
                <p className="text-sm text-cortex-text leading-relaxed">{note.raw_content}</p>
              </div>
            ))}
            {hiddenNotes > 0 && (
              <button
                onClick={() => setShowAllNotes(v => !v)}
                className="w-full text-xs text-cortex-muted hover:text-amber-500 border border-dashed border-amber-500/20 rounded-lg py-2 transition-colors"
              >
                {showAllNotes ? 'Show fewer' : `Show ${hiddenNotes} more note${hiddenNotes !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}
      </Section>

      {/* Activity Thread */}
      <Section
        title="Activity Thread"
        icon={MessageSquare}
        badge={publicThreads.length > 0 ? publicThreads.length : undefined}
        defaultOpen={false}
        headerRight={
          publicThreads.length > 0 ? (
            <button
              onClick={() => setThreadExpanded(v => !v)}
              className="text-[11px] text-cortex-muted hover:text-cortex-accent transition-colors font-medium"
            >
              {threadExpanded ? 'Compact' : 'Full view'}
            </button>
          ) : null
        }
      >
        {publicThreads.length === 0 ? (
          <p className="text-xs text-cortex-muted text-center py-3">No activity recorded</p>
        ) : threadExpanded ? (
          <div className="space-y-4">
            {publicThreads.map(thread => (
              <div key={thread.id} className="relative pl-5 pb-5 border-l-2 border-cortex-border last:pb-0">
                <div className="absolute left-0 top-1 w-2 h-2 -translate-x-[5px] rounded-full bg-cortex-accent" />
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{thread.actor_name || 'System'}</span>
                  <span className="badge bg-cortex-bg border border-cortex-border text-cortex-muted text-[10px]">
                    {thread.action_type?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-cortex-muted font-mono ml-auto">{formatRelativeTime(thread.created_at)}</span>
                </div>
                {thread.raw_content && (
                  <p className="text-sm text-cortex-muted bg-cortex-bg rounded-lg p-3 mt-2">{thread.raw_content}</p>
                )}
                {thread.ai_summary && (
                  <p className="text-sm text-cortex-accent bg-cortex-accent/5 rounded-lg p-3 mt-2">✨ {thread.ai_summary}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-cortex-border/40 -mx-1">
            {publicThreads.map(thread => (
              <div key={thread.id} className="flex items-center gap-3 py-2.5 px-1 text-xs hover:bg-cortex-surface-raised/50 rounded transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-cortex-accent flex-shrink-0" />
                <span className="font-medium text-cortex-text w-24 flex-shrink-0 truncate">{thread.actor_name || 'System'}</span>
                <span className="badge bg-cortex-bg border border-cortex-border text-cortex-muted text-[10px] flex-shrink-0">
                  {thread.action_type?.replace(/_/g, ' ')}
                </span>
                {thread.raw_content && (
                  <span className="text-cortex-muted flex-1 truncate hidden sm:block">{thread.raw_content}</span>
                )}
                <span className="text-cortex-muted font-mono flex-shrink-0 ml-auto">{formatRelativeTime(thread.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
