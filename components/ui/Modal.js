'use client'

import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/70" onClick={onClose}></div>
        
        <div className="relative bg-cortex-surface border border-cortex-border rounded-lg max-w-2xl w-full p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-cortex-border rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {children}
        </div>
      </div>
    </div>
  )
}
