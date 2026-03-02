'use client'

import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="relative bg-cortex-surface border border-cortex-border rounded-2xl max-w-2xl w-full animate-slide-in shadow-card-hover max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 pt-6 pb-0 flex-shrink-0">
            <h2 className="text-xl font-display font-bold text-cortex-text">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-cortex-surface-raised rounded-lg transition-colors text-cortex-muted hover:text-cortex-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 pb-6 pt-6 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
