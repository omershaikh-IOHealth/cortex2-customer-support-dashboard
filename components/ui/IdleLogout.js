'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

const IDLE_MS   = 10 * 60 * 1000  // 10 minutes
const WARN_MS   = 60 * 1000        // show warning 1 min before logout

export default function IdleLogout() {
  const [countdown, setCountdown] = useState(null) // seconds remaining
  const timerRef   = useRef(null)
  const warnRef    = useRef(null)
  const countRef   = useRef(null)

  function reset() {
    clearTimeout(timerRef.current)
    clearTimeout(warnRef.current)
    clearInterval(countRef.current)
    setCountdown(null)

    // Set warning at (IDLE_MS - WARN_MS)
    warnRef.current = setTimeout(() => {
      setCountdown(60)
      countRef.current = setInterval(() => {
        setCountdown(s => {
          if (s <= 1) { clearInterval(countRef.current); return 0 }
          return s - 1
        })
      }, 1000)
    }, IDLE_MS - WARN_MS)

    // Actual logout at IDLE_MS
    timerRef.current = setTimeout(() => {
      signOut({ callbackUrl: '/login' })
    }, IDLE_MS)
  }

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset() // start timer on mount
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(timerRef.current)
      clearTimeout(warnRef.current)
      clearInterval(countRef.current)
    }
  }, [])

  if (countdown === null) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-cortex-surface border border-cortex-warning/50 rounded-xl shadow-2xl px-5 py-3 text-sm animate-fade-in">
      <LogOut className="w-4 h-4 text-cortex-warning shrink-0" />
      <span className="text-cortex-text">
        Session expires in <span className="font-mono font-bold text-cortex-warning">{countdown}s</span> due to inactivity
      </span>
      <button
        onClick={reset}
        className="btn-secondary text-xs px-3 py-1"
      >
        Stay logged in
      </button>
    </div>
  )
}
