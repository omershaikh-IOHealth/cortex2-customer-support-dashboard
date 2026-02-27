import { Inbox } from 'lucide-react'

/**
 * EmptyState — shown when a list has no items.
 *
 * Props:
 *   icon      — Lucide icon component (defaults to Inbox)
 *   title     — headline text
 *   message   — supporting copy (optional)
 *   action    — { label, onClick } for an optional CTA button (optional)
 */
export default function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-cortex-surface-raised flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-cortex-muted opacity-50" strokeWidth={1.5} />
      </div>
      <p className="font-semibold text-cortex-text mb-1">{title}</p>
      {message && <p className="text-cortex-muted text-sm max-w-xs leading-relaxed">{message}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-5 text-sm">
          {action.label}
        </button>
      )}
    </div>
  )
}
