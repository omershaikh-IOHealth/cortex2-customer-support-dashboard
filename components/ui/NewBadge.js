'use client'

import { useState, useRef } from 'react'

/**
 * NewBadge — shows a small "NEW" chip that reveals a description tooltip on hover.
 * Uses position:fixed for the tooltip so it escapes overflow:auto containers (e.g. sidebars).
 */
export default function NewBadge({ description, className = '' }) {
  const [tip, setTip] = useState(null)
  const ref = useRef(null)

  function handleEnter() {
    if (!description || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setTip({ top: r.top - 8, cx: r.left + r.width / 2 })
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setTip(null)}
        className={`inline-flex flex-shrink-0 items-center cursor-default ${className}`}
      >
        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cortex-accent text-white rounded-full uppercase tracking-wide select-none leading-none">
          NEW
        </span>
      </span>

      {tip && (
        <div
          style={{
            position: 'fixed',
            top: tip.top,
            left: tip.cx,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
          }}
          className="w-56 bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2.5 shadow-2xl leading-relaxed pointer-events-none"
        >
          {description}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-900" />
        </div>
      )}
    </>
  )
}
