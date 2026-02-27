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
      <Icon className="w-10 h-10 text-cortex-muted mb-4" strokeWidth={1.5} />
      <p className="text-cortex-text font-medium mb-1">{title}</p>
      {message && <p className="text-cortex-muted text-sm max-w-xs">{message}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-4 text-sm">
          {action.label}
        </button>
      )}
    </div>
  )
}
