'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

const WARN_MS = 60 * 1000 // show warning 1 min before logout
const DEFAULT_IDLE_MINS = 15

export default function IdleLogout() {
  const [countdown, setCountdown] = useState(null) // seconds remaining
  // null = settings not yet loaded; true = enabled; false = disabled
  const [autoLogoffEnabled, setAutoLogoffEnabled] = useState(null)
  const [idleMs, setIdleMs] = useState(DEFAULT_IDLE_MINS * 60 * 1000)
  const timerRef  = useRef(null)
  const warnRef   = useRef(null)
  const countRef  = useRef(null)
  const idleMsRef = useRef(DEFAULT_IDLE_MINS * 60 * 1000)

  // Fetch admin settings on mount
  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) {
          // Can't load settings — default to enabled with DEFAULT_IDLE_MINS
          setAutoLogoffEnabled(true)
          return
        }
        const enabled = data.auto_logoff_enabled !== 'false'
        if (!enabled) {
          setAutoLogoffEnabled(false)
          return
        }
        const mins = parseInt(data.auto_logoff_minutes) || DEFAULT_IDLE_MINS
        const ms = mins * 60 * 1000
        setIdleMs(ms)
        idleMsRef.current = ms
        setAutoLogoffEnabled(true)
      })
      .catch(() => {
        // On error fall back to enabled with default timeout
        setAutoLogoffEnabled(true)
      })
  }, [])

  function reset() {
    clearTimeout(timerRef.current)
    clearTimeout(warnRef.current)
    clearInterval(countRef.current)
    setCountdown(null)

    const currentIdleMs = idleMsRef.current
    warnRef.current = setTimeout(() => {
      setCountdown(60)
      countRef.current = setInterval(() => {
        setCountdown(s => {
          if (s <= 1) { clearInterval(countRef.current); return 0 }
          return s - 1
        })
      }, 1000)
    }, Math.max(currentIdleMs - WARN_MS, 0))

    timerRef.current = setTimeout(() => {
      const todayStr = new Date().toISOString().slice(0, 10)
      const sessionStart = sessionStorage.getItem('cortex_session_start')
      if (sessionStart) {
        const elapsed = Math.floor((Date.now() - new Date(sessionStart).getTime()) / 1000)
        const acc = parseInt(localStorage.getItem(`cortex_acc_${todayStr}`) || '0', 10)
        localStorage.setItem(`cortex_acc_${todayStr}`, acc + elapsed)
        sessionStorage.removeItem('cortex_session_start')
      }
      signOut({ callbackUrl: '/login' })
    }, currentIdleMs)
  }

  // Only register idle listeners once settings confirm auto-logoff is enabled
  useEffect(() => {
    if (autoLogoffEnabled !== true) return // still loading or explicitly disabled

    idleMsRef.current = idleMs // sync latest idle duration
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset() // start timer
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearTimeout(timerRef.current)
      clearTimeout(warnRef.current)
      clearInterval(countRef.current)
    }
  }, [autoLogoffEnabled, idleMs]) // re-run if settings change

  if (countdown === null) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-cortex-surface border border-cortex-warning/50 rounded-xl shadow-2xl px-5 py-3 text-sm animate-fade-in">
      <LogOut className="w-4 h-4 text-cortex-warning shrink-0" />
      <span className="text-cortex-text">
        Session expires in <span className="font-mono font-bold text-cortex-warning">{countdown}s</span> due to inactivity
      </span>
      <button onClick={reset} className="btn-secondary text-xs px-3 py-1">
        Stay logged in
      </button>
    </div>
  )
}
