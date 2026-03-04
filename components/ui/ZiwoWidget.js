'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Script from 'next/script'
import { useSession } from 'next-auth/react'
import { getMe, logCall, createTicket, updateCallLog, createPOC, createCompany } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  PauseCircle,
  PlayCircle,
  Minimize2,
  Maximize2,
  Loader2,
  Delete,
  AlertCircle,
  RefreshCw,
  UserX,
} from 'lucide-react'

const S = {
  LOADING: 'loading',
  NO_CREDS: 'no_creds',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RINGING: 'ringing',
  ACTIVE: 'active',
  ENDED: 'ended',
  ERROR: 'error',
}

function fmt(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const DIAL_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
]

export default function ZiwoWidget({ contactCenterName = 'iohealth' }) {
  const { data: session } = useSession()

  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [credentials, setCredentials] = useState(null)
  const [status, setStatus] = useState(S.LOADING)
  const [loadingPhase, setLoadingPhase] = useState('credentials') // 'credentials' | 'sdk' | null
  const [agentName, setAgentName] = useState('')
  const [callInfo, setCallInfo] = useState(null)   // { number, direction }
  const [endedInfo, setEndedInfo] = useState(null) // { duration, direction, number, cause, ... }
  const [timer, setTimer] = useState(0)
  const [isHeld, setIsHeld] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [dialNumber, setDialNumber] = useState('')
  const [minimized, setMinimized] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Caller screen pop state
  const [callerPOC, setCallerPOC] = useState(null) // null | { id, name, is_vip, company_name, open_ticket_count }

  // Post-call ticket form state
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketTitle, setTicketTitle] = useState('')
  const [ticketDesc, setTicketDesc] = useState('')
  const [ticketPriority, setTicketPriority] = useState('P3')
  const [creatingTicket, setCreatingTicket] = useState(false)

  // POC (customer) section
  const [pocMode, setPocMode] = useState('search')
  const [pocSearch, setPocSearch] = useState('')
  const [pocResults, setPocResults] = useState([])
  const [pocSearching, setPocSearching] = useState(false)
  const [selectedPOC, setSelectedPOC] = useState(null)
  const [newPOCName, setNewPOCName] = useState('')
  const [newPOCEmail, setNewPOCEmail] = useState('')
  const [newPOCPhone, setNewPOCPhone] = useState('')
  // Org (company) section
  const [orgMode, setOrgMode] = useState('search')
  const [orgSearch, setOrgSearch] = useState('')
  const [allOrgs, setAllOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [newOrgName, setNewOrgName] = useState('')

  // Drag state — default bottom-4 right-4 (16px each)
  const [pos, setPos] = useState({ bottom: 16, right: 16 })
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origRight: 16, origBottom: 16 })
  const [isDragging, setIsDragging] = useState(false)

  const mediaRef = useRef(null)
  const clientRef = useRef(null)
  const timerRef = useRef(null)
  const callStartRef = useRef(null)
  const currentCallRef = useRef(null)
  const initDoneRef = useRef(false)
  const callerPOCRef = useRef(null)

  // Keep callerPOCRef in sync so event-listener closures can read the latest value
  useEffect(() => { callerPOCRef.current = callerPOC }, [callerPOC])

  // Debounced POC search
  useEffect(() => {
    if (!pocSearch.trim() || pocMode !== 'search') { setPocResults([]); return }
    const t = setTimeout(() => {
      setPocSearching(true)
      fetch(`/api/admin/pocs?search=${encodeURIComponent(pocSearch)}`)
        .then(r => r.ok ? r.json() : [])
        .then(d => setPocResults(Array.isArray(d) ? d.slice(0, 5) : []))
        .catch(() => setPocResults([]))
        .finally(() => setPocSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [pocSearch, pocMode])

  // If the Script was already loaded by a previous mount (e.g. page navigation),
  // Next.js won't fire onLoad again — detect it synchronously on mount.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ziwoCoreFront) {
      setSdkLoaded(true)
    }
  }, [])

  // Drag — status bar acts as drag handle
  useEffect(() => {
    function onMove(e) {
      if (!dragState.current.dragging) return
      const dx = e.clientX - dragState.current.startX
      const dy = e.clientY - dragState.current.startY
      setPos({
        right: Math.max(0, dragState.current.origRight - dx),
        bottom: Math.max(0, dragState.current.origBottom - dy),
      })
    }
    function onUp() {
      if (dragState.current.dragging) {
        dragState.current.dragging = false
        setIsDragging(false)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  function startDrag(e) {
    e.preventDefault()
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origRight: pos.right,
      origBottom: pos.bottom,
    }
    setIsDragging(true)
  }

  // Fetch ZIWO credentials from /api/users/me
  useEffect(() => {
    if (!session?.user) return
    setLoadingPhase('credentials')
    getMe()
      .then(data => {
        if (data?.ziwo_email && data?.ziwo_password) {
          setCredentials({ email: data.ziwo_email, password: data.ziwo_password })
          setLoadingPhase('sdk')
        } else {
          setStatus(S.NO_CREDS)
          setLoadingPhase(null)
        }
      })
      .catch(() => {
        setStatus(S.ERROR)
        setLoadingPhase(null)
      })
  }, [session?.user, retryCount])

  // Initialize ZIWO client once SDK is loaded AND credentials are ready
  const initClient = useCallback(() => {
    if (!sdkLoaded || !credentials || !mediaRef.current || initDoneRef.current) return
    if (typeof window === 'undefined' || !window.ziwoCoreFront) return

    initDoneRef.current = true
    setLoadingPhase(null)
    const { ZiwoClient } = window.ziwoCoreFront
    const client = new ZiwoClient({
      contactCenterName,
      credentials,
      mediaTag: mediaRef.current,
      debug: false,
      useGoogleStun: false,
    })
    clientRef.current = client
    setStatus(S.CONNECTING)

    client.connect()
      .then(() => {
        // ziwo-connected fires when Verto WebSocket is ready
      })
      .catch(err => {
        console.error('[ZiwoWidget] connect error:', err)
        setStatus(S.ERROR)
      })
  }, [sdkLoaded, credentials, contactCenterName])

  useEffect(() => { initClient() }, [initClient])

  // Timer helpers
  function startTimer() {
    callStartRef.current = Date.now()
    setTimer(0)
    timerRef.current = setInterval(
      () => setTimer(Math.floor((Date.now() - callStartRef.current) / 1000)),
      1000
    )
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    return callStartRef.current ? Math.floor((Date.now() - callStartRef.current) / 1000) : 0
  }

  // Wire all ZIWO window events
  useEffect(() => {
    const on = (event, handler) => window.addEventListener(event, handler)
    const off = (event, handler) => window.removeEventListener(event, handler)

    function onConnected(e) {
      const ui = e.detail?.agent?.userInfo
      const name = ui
        ? `${ui.firstName || ''} ${ui.lastName || ''}`.trim() || ui.email || 'Agent'
        : (session?.user?.name || 'Agent')
      setAgentName(name)
      setStatus(S.CONNECTED)
      // Sync Cortex status to 'available' when ZIWO connects
      if (session?.user?.id) {
        fetch(`/api/users/${session.user.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'available' }),
        }).catch(() => {})
        // Notify AgentSidebar to update its displayed status
        window.dispatchEvent(new CustomEvent('cortex-ziwo-connected', { detail: { status: 'available' } }))
      }
    }
    function onDisconnected() { setStatus(S.ERROR) }
    function onError(e) {
      if (e.detail?.code === 1003) return // Benign post-hangup BYE ACK
      console.warn('[ZiwoWidget] error', e.detail)
    }
    function onRinging(e) {
      const number = e.detail?.customerNumber || ''
      currentCallRef.current = e.detail?.currentCall
      setCallInfo({ number: number || 'Unknown', direction: e.detail?.direction || 'inbound' })
      setStatus(S.RINGING)
      // Fetch caller info for screen pop
      setCallerPOC(null)
      if (number) {
        fetch(`/api/pocs?phone=${encodeURIComponent(number)}`)
          .then(r => r.ok ? r.json() : null)
          .then(poc => setCallerPOC(poc || null))
          .catch(() => {})
      }
    }
    function onActive(e) {
      currentCallRef.current = e.detail?.currentCall
      setCallInfo(prev => ({ ...prev, number: e.detail?.customerNumber || prev?.number }))
      setIsHeld(false)
      setIsMuted(false)
      startTimer()
      setStatus(S.ACTIVE)
    }
    function onHeld() { setIsHeld(true) }
    function onUnheld() { setIsHeld(false) }
    function onMute() { setIsMuted(true) }
    function onUnmute() { setIsMuted(false) }
    function onHangup(e) {
      const secs = stopTimer()
      const ended = {
        duration: secs,
        direction: e.detail?.direction || callInfo?.direction || '—',
        number: e.detail?.customerNumber || callInfo?.number || '—',
        cause: e.detail?.origin || e.detail?.cause || 'normal',
        primaryCallId: e.detail?.primaryCallID,
        callId: e.detail?.callID,
        startedAt: callStartRef.current,
      }
      setEndedInfo(ended)
      // Capture callerPOC before clearing (ref holds latest value)
      const snapPOC = callerPOCRef.current
      setCallerPOC(null)
      setShowTicketForm(true)
      setTicketTitle('')
      setTicketDesc('')
      setTicketPriority('P3')
      // Reset POC/org form
      setPocMode('search'); setPocSearch(''); setPocResults([])
      setNewPOCName(''); setNewPOCEmail(''); setNewPOCPhone('')
      setOrgMode('search'); setOrgSearch(''); setSelectedOrg(null); setNewOrgName('')
      // Pre-populate from caller screen pop
      setSelectedPOC(snapPOC?.id ? { id: snapPOC.id, name: snapPOC.name } : null)
      // Load orgs for dropdown
      fetch('/api/admin/companies').then(r => r.json()).then(d => setAllOrgs(Array.isArray(d) ? d : [])).catch(() => {})
      currentCallRef.current = null
      setStatus(S.ENDED)
      window.dispatchEvent(new CustomEvent('cortex-wrap-up-start'))
    }
    function onDestroy() {
      if (currentCallRef.current) {
        stopTimer()
        currentCallRef.current = null
        setStatus(S.CONNECTED)
      }
    }

    on('ziwo-connected', onConnected)
    on('ziwo-disconnected', onDisconnected)
    on('ziwo-error', onError)
    on('ziwo-ringing', onRinging)
    on('ziwo-active', onActive)
    on('ziwo-held', onHeld)
    on('ziwo-unheld', onUnheld)
    on('ziwo-mute', onMute)
    on('ziwo-unmute', onUnmute)
    on('ziwo-hangup', onHangup)
    on('ziwo-destroy', onDestroy)

    return () => {
      off('ziwo-connected', onConnected)
      off('ziwo-disconnected', onDisconnected)
      off('ziwo-error', onError)
      off('ziwo-ringing', onRinging)
      off('ziwo-active', onActive)
      off('ziwo-held', onHeld)
      off('ziwo-unheld', onUnheld)
      off('ziwo-mute', onMute)
      off('ziwo-unmute', onUnmute)
      off('ziwo-hangup', onHangup)
      off('ziwo-destroy', onDestroy)
    }
  }, [session?.user?.name, session?.user?.id, callInfo?.direction, callInfo?.number])

  // Sync Cortex status changes to ZIWO agent state
  useEffect(() => {
    function onStatusChange(e) {
      const s = e.detail?.status
      if (!clientRef.current || status !== S.CONNECTED) return
      try {
        if (s === 'available') clientRef.current.setAvailable?.()
        else if (s === 'break' || s === 'not_ready') clientRef.current.setNotReady?.()
      } catch (_) {}
    }
    window.addEventListener('cortex-status-change', onStatusChange)
    return () => window.removeEventListener('cortex-status-change', onStatusChange)
  }, [status])

  // Log call to DB after hangup
  useEffect(() => {
    if (status !== S.ENDED || !endedInfo?.primaryCallId) return
    logCall({
      primary_call_id: endedInfo.primaryCallId,
      agent_call_id: endedInfo.callId,
      direction: endedInfo.direction,
      customer_number: endedInfo.number,
      duration_secs: endedInfo.duration,
      hangup_cause: endedInfo.cause,
      status: 'ended',
      started_at: endedInfo.startedAt ? new Date(endedInfo.startedAt).toISOString() : null,
    }).catch(err => console.warn('[ZiwoWidget] call log failed:', err))
  }, [status, endedInfo])

  function handleAnswer() { currentCallRef.current?.answer() }
  function handleReject() { currentCallRef.current?.hangup() }
  function handleHangup() { currentCallRef.current?.hangup() }
  function handleHold() {
    if (!currentCallRef.current) return
    isHeld ? currentCallRef.current.unhold() : currentCallRef.current.hold()
  }
  function handleMute() {
    if (!currentCallRef.current) return
    isMuted ? currentCallRef.current.unmute() : currentCallRef.current.mute()
  }
  function handleDial() {
    const num = dialNumber.trim()
    if (!num || !clientRef.current) return
    clientRef.current.startCall(num)
    setDialNumber('')
  }
  function handleRetry() {
    initDoneRef.current = false
    clientRef.current = null
    setStatus(S.LOADING)
    setCredentials(null)
    setRetryCount(c => c + 1)
  }
  function handleDialKey(key) {
    setDialNumber(prev => prev + key)
  }
  function handleDialBackspace() {
    setDialNumber(prev => prev.slice(0, -1))
  }

  // ── Status dot color ────────────────────────────────────────────────────
  const dotColor = {
    [S.LOADING]: 'bg-cortex-muted',
    [S.NO_CREDS]: 'bg-cortex-warning',
    [S.CONNECTING]: 'bg-cortex-warning animate-pulse',
    [S.CONNECTED]: 'bg-cortex-success',
    [S.RINGING]: 'bg-cortex-warning animate-ping',
    [S.ACTIVE]: 'bg-cortex-success animate-pulse',
    [S.ENDED]: 'bg-cortex-muted',
    [S.ERROR]: 'bg-cortex-danger',
  }[status] || 'bg-cortex-muted'

  const loadingLabel = loadingPhase === 'credentials'
    ? 'Fetching credentials…'
    : loadingPhase === 'sdk'
      ? 'Loading ZIWO SDK…'
      : 'Connecting…'

  const statusLabel = {
    [S.LOADING]: loadingLabel,
    [S.NO_CREDS]: 'ZIWO not configured',
    [S.CONNECTING]: 'Connecting to ZIWO…',
    [S.CONNECTED]: agentName ? `${agentName} — Ready` : 'Connected — Ready',
    [S.RINGING]: 'Incoming call…',
    [S.ACTIVE]: 'Call active',
    [S.ENDED]: 'Call ended',
    [S.ERROR]: 'Connection error',
  }[status] || status

  return (
    <>
      {/* ZIWO SDK — afterInteractive loads after hydration, before user interaction */}
      <Script
        src="https://cdn.jsdelivr.net/npm/ziwo-core-front@1.0.13/dist/ziwo-core-front.umd.js"
        strategy="afterInteractive"
        onLoad={() => setSdkLoaded(true)}
      />

      {/* Hidden WebRTC audio sink — SDK injects <video> elements here */}
      <div ref={mediaRef} style={{ display: 'none' }} aria-hidden="true" />

      {/* ── Widget ── */}
      <div
        className={`fixed z-50 w-72 bg-cortex-surface border border-cortex-border rounded-xl shadow-2xl overflow-hidden${isDragging ? ' select-none' : ''}`}
        style={{ bottom: `${pos.bottom}px`, right: `${pos.right}px` }}
      >

        {/* Status bar — drag handle */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-cortex-border bg-cortex-bg/50 cursor-grab active:cursor-grabbing"
          onMouseDown={startDrag}
          title="Drag to reposition"
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-xs font-mono text-cortex-text flex-1 truncate">{statusLabel}</span>
          <button
            onClick={() => setMinimized(m => !m)}
            onMouseDown={e => e.stopPropagation()}
            className="text-cortex-muted hover:text-cortex-text transition-colors"
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {!minimized && (
          <div className="p-4 space-y-3">

            {/* ── Ringing panel ── */}
            {status === S.RINGING && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-cortex-warning font-mono uppercase tracking-wider mb-1">
                    Incoming Call
                  </p>
                  <p className="text-2xl font-bold font-mono text-cortex-text">
                    {callInfo?.number}
                  </p>
                  <p className="text-xs text-cortex-muted mt-0.5">
                    {callInfo?.direction} · waiting to answer
                  </p>
                </div>

                {/* Caller screen pop */}
                {callerPOC ? (
                  <div className="rounded-lg border border-cortex-border bg-cortex-bg px-3 py-2.5 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-cortex-text truncate">{callerPOC.name}</span>
                      {callerPOC.is_vip && <span title="VIP customer" className="text-base leading-none">⭐</span>}
                    </div>
                    {callerPOC.company_name && (
                      <p className="text-xs text-cortex-muted">{callerPOC.company_name}</p>
                    )}
                    <p className="text-xs text-cortex-muted">
                      {callerPOC.open_ticket_count} open ticket{callerPOC.open_ticket_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                ) : callInfo?.number && callInfo.number !== 'Unknown' ? (
                  <div className="rounded-lg border border-cortex-border bg-cortex-bg px-3 py-2 text-xs text-cortex-muted">
                    Unknown caller
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <button
                    onClick={handleAnswer}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cortex-success/20 text-cortex-success border border-cortex-success/30 hover:bg-cortex-success/30 transition-colors text-sm font-medium"
                  >
                    <PhoneIncoming className="w-4 h-4" /> Answer
                  </button>
                  <button
                    onClick={handleReject}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cortex-danger/20 text-cortex-danger border border-cortex-danger/30 hover:bg-cortex-danger/30 transition-colors text-sm font-medium"
                  >
                    <PhoneOff className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            )}

            {/* ── Active call panel ── */}
            {status === S.ACTIVE && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-cortex-success font-mono uppercase tracking-wider mb-1">
                    Active Call
                  </p>
                  <p className="text-xl font-bold font-mono text-cortex-text">
                    {callInfo?.number}
                  </p>
                  <p className="text-3xl font-bold font-mono text-cortex-accent mt-1 tabular-nums">
                    {fmt(timer)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleHold}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      isHeld
                        ? 'bg-cortex-warning/20 text-cortex-warning border-cortex-warning/30 hover:bg-cortex-warning/30'
                        : 'bg-cortex-surface text-cortex-muted border-cortex-border hover:text-cortex-text hover:border-cortex-muted'
                    }`}
                  >
                    {isHeld ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                    {isHeld ? 'Unhold' : 'Hold'}
                  </button>
                  <button
                    onClick={handleMute}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      isMuted
                        ? 'bg-cortex-warning/20 text-cortex-warning border-cortex-warning/30 hover:bg-cortex-warning/30'
                        : 'bg-cortex-surface text-cortex-muted border-cortex-border hover:text-cortex-text hover:border-cortex-muted'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    onClick={handleHangup}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-cortex-danger/20 text-cortex-danger border border-cortex-danger/30 hover:bg-cortex-danger/30 transition-colors text-xs font-medium"
                  >
                    <PhoneOff className="w-3.5 h-3.5" /> End
                  </button>
                </div>
              </div>
            )}

            {/* ── Ended call summary + ticket creation ── */}
            {status === S.ENDED && endedInfo && (
              <div className="space-y-3">
                {/* Call summary */}
                <div>
                  <p className="text-xs text-cortex-muted font-mono uppercase tracking-wider mb-2">
                    Call Ended
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-cortex-muted">Duration</span>
                    <span className="text-cortex-text font-mono">{fmt(endedInfo.duration)}</span>
                    <span className="text-cortex-muted">Number</span>
                    <span className="text-cortex-text font-mono truncate">{endedInfo.number}</span>
                  </div>
                </div>

                {/* Ticket creation form */}
                {showTicketForm ? (
                  <div className="space-y-2.5 border-t border-cortex-border/60 pt-3">
                    <p className="text-xs font-semibold text-cortex-text">Create ticket for this call</p>
                    <input
                      type="text"
                      placeholder="Title *"
                      value={ticketTitle}
                      onChange={e => setTicketTitle(e.target.value)}
                      className="input text-xs py-1.5"
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={ticketDesc}
                      onChange={e => setTicketDesc(e.target.value)}
                      className="input text-xs py-1.5 resize-none h-16"
                    />
                    <select
                      value={ticketPriority}
                      onChange={e => setTicketPriority(e.target.value)}
                      className="input text-xs py-1.5"
                    >
                      <option value="P1">P1 — Critical</option>
                      <option value="P2">P2 — High</option>
                      <option value="P3">P3 — Medium</option>
                      <option value="P4">P4 — Low</option>
                    </select>

                    {/* ── Customer (POC) ── */}
                    <div className="rounded-lg border border-cortex-border bg-cortex-bg p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-cortex-muted uppercase tracking-wide">Customer (optional)</p>
                        <div className="flex gap-1">
                          {['search', 'create'].map(m => (
                            <button key={m} onClick={() => { setPocMode(m); setSelectedPOC(null); setPocSearch('') }}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${pocMode === m ? 'bg-cortex-accent/15 text-cortex-accent' : 'text-cortex-muted hover:text-cortex-text'}`}>
                              {m === 'search' ? 'Existing' : 'New'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {pocMode === 'search' ? (
                        <div className="relative">
                          {selectedPOC ? (
                            <div className="flex items-center justify-between bg-cortex-accent/10 rounded px-2 py-1">
                              <span className="text-xs text-cortex-accent truncate">{selectedPOC.name}</span>
                              <button onClick={() => setSelectedPOC(null)} className="text-cortex-muted hover:text-cortex-danger ml-1 flex-shrink-0 text-[10px]">✕</button>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text" placeholder="Search by name / email…" value={pocSearch}
                                onChange={e => setPocSearch(e.target.value)}
                                className="input text-xs py-1.5"
                              />
                              {pocSearching && <p className="text-[10px] text-cortex-muted px-1">Searching…</p>}
                              {pocResults.length > 0 && (
                                <div className="absolute z-10 left-0 right-0 mt-0.5 bg-cortex-surface border border-cortex-border rounded-lg shadow-lg overflow-hidden">
                                  {pocResults.map(p => (
                                    <button key={p.id} onClick={() => { setSelectedPOC({ id: p.id, name: p.name }); setPocSearch(''); setPocResults([]) }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-cortex-surface-raised transition-colors">
                                      <span className="font-medium text-cortex-text">{p.name}</span>
                                      {p.company_name && <span className="text-cortex-muted ml-1">· {p.company_name}</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <input type="text" placeholder="Name *" value={newPOCName} onChange={e => setNewPOCName(e.target.value)} className="input text-xs py-1" />
                          <input type="email" placeholder="Email" value={newPOCEmail} onChange={e => setNewPOCEmail(e.target.value)} className="input text-xs py-1" />
                          <input type="tel" placeholder="Phone" value={newPOCPhone} onChange={e => setNewPOCPhone(e.target.value)} className="input text-xs py-1" />
                        </div>
                      )}
                    </div>

                    {/* ── Organization ── */}
                    <div className="rounded-lg border border-cortex-border bg-cortex-bg p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-cortex-muted uppercase tracking-wide">Organization (optional)</p>
                        <div className="flex gap-1">
                          {['search', 'create'].map(m => (
                            <button key={m} onClick={() => { setOrgMode(m); setSelectedOrg(null); setOrgSearch('') }}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${orgMode === m ? 'bg-cortex-accent/15 text-cortex-accent' : 'text-cortex-muted hover:text-cortex-text'}`}>
                              {m === 'search' ? 'Existing' : 'New'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {orgMode === 'search' ? (
                        selectedOrg ? (
                          <div className="flex items-center justify-between bg-cortex-accent/10 rounded px-2 py-1">
                            <span className="text-xs text-cortex-accent truncate">{selectedOrg.company_name}</span>
                            <button onClick={() => setSelectedOrg(null)} className="text-cortex-muted hover:text-cortex-danger ml-1 flex-shrink-0 text-[10px]">✕</button>
                          </div>
                        ) : (
                          <div>
                            <input type="text" placeholder="Filter organizations…" value={orgSearch} onChange={e => setOrgSearch(e.target.value)} className="input text-xs py-1.5" />
                            {orgSearch.trim() && (
                              <div className="mt-0.5 max-h-24 overflow-y-auto bg-cortex-surface border border-cortex-border rounded-lg shadow-lg">
                                {allOrgs.filter(o => o.company_name?.toLowerCase().includes(orgSearch.toLowerCase())).slice(0, 5).map(o => (
                                  <button key={o.id} onClick={() => { setSelectedOrg({ id: o.id, company_name: o.company_name }); setOrgSearch('') }}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-cortex-surface-raised transition-colors text-cortex-text">
                                    {o.company_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <input type="text" placeholder="Company name *" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} className="input text-xs py-1" />
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!ticketTitle.trim()) return
                          setCreatingTicket(true)
                          try {
                            let poc_id = selectedPOC?.id || undefined
                            let company_id = selectedOrg?.id || undefined

                            // Create new org first (so POC can be linked to it)
                            if (orgMode === 'create' && newOrgName.trim()) {
                              const org = await createCompany({ company_name: newOrgName.trim(), company_code: newOrgName.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 20) })
                              company_id = org.id
                            }

                            // Create new POC (linked to org if available)
                            if (pocMode === 'create' && newPOCName.trim()) {
                              const poc = await createPOC({ name: newPOCName.trim(), email: newPOCEmail.trim() || undefined, phone: newPOCPhone.trim() || undefined, company_id: company_id || undefined })
                              poc_id = poc.id
                            }

                            const ticket = await createTicket({
                              title: ticketTitle.trim(),
                              description: ticketDesc.trim() || undefined,
                              priority: ticketPriority,
                              channel: 'voice',
                              poc_id,
                              company_id,
                            })
                            if (endedInfo.primaryCallId) {
                              updateCallLog(endedInfo.primaryCallId, { ticket_id: ticket.id }).catch(() => {})
                            }
                            toast.success(`Ticket #${ticket.id} created`)
                          } catch (e) {
                            toast.error(e.message || 'Failed to create ticket')
                          } finally {
                            setCreatingTicket(false)
                            setShowTicketForm(false)
                            setEndedInfo(null)
                            setStatus(S.CONNECTED)
                          }
                        }}
                        disabled={!ticketTitle.trim() || creatingTicket}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-cortex-accent/15 text-cortex-accent border border-cortex-accent/30 hover:bg-cortex-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {creatingTicket ? 'Creating…' : 'Create Ticket'}
                      </button>
                      <button
                        onClick={() => {
                          setShowTicketForm(false)
                          setEndedInfo(null)
                          setStatus(S.CONNECTED)
                        }}
                        className="px-3 py-1.5 text-xs text-cortex-muted hover:text-cortex-text border border-cortex-border rounded-lg transition-colors"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Idle: outbound dial pad ── */}
            {status === S.CONNECTED && (
              <div className="space-y-2">
                <p className="text-xs text-cortex-muted font-mono">Outbound Dial</p>

                {/* Number display + backspace */}
                <div className="flex gap-2">
                  <div className="flex-1 input text-sm py-2 font-mono min-h-[38px] flex items-center overflow-hidden">
                    {dialNumber
                      ? <span className="truncate">{dialNumber}</span>
                      : <span className="text-cortex-muted">+971…</span>
                    }
                  </div>
                  <button
                    onClick={handleDialBackspace}
                    disabled={!dialNumber}
                    className="px-3 py-2 rounded-lg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:border-cortex-muted disabled:opacity-30 transition-colors"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                </div>

                {/* Numeric keypad */}
                <div className="grid grid-cols-3 gap-1.5">
                  {DIAL_KEYS.flat().map(key => (
                    <button
                      key={key}
                      onClick={() => handleDialKey(key)}
                      className="py-2.5 rounded-lg bg-cortex-bg border border-cortex-border text-cortex-text text-sm font-mono font-medium hover:bg-cortex-border hover:border-cortex-muted transition-colors active:scale-95"
                    >
                      {key}
                    </button>
                  ))}
                </div>

                {/* Call button */}
                <button
                  onClick={handleDial}
                  disabled={!dialNumber.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cortex-success/20 text-cortex-success border border-cortex-success/30 hover:bg-cortex-success/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Phone className="w-4 h-4" /> Call
                </button>
              </div>
            )}

            {/* ── Loading / Connecting spinner ── */}
            {(status === S.LOADING || status === S.CONNECTING) && (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Loader2 className="w-6 h-6 text-cortex-muted animate-spin" />
                <p className="text-xs text-cortex-muted">{statusLabel}</p>
              </div>
            )}

            {/* ── No credentials panel ── */}
            {status === S.NO_CREDS && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <UserX className="w-8 h-8 text-cortex-muted" />
                <div>
                  <p className="text-sm font-medium text-cortex-text">ZIWO Not Configured</p>
                  <p className="text-xs text-cortex-muted mt-1 leading-relaxed">
                    Your account has no ZIWO credentials linked.<br />
                    Contact your administrator to set up calling.
                  </p>
                </div>
              </div>
            )}

            {/* ── Error state with retry ── */}
            {status === S.ERROR && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertCircle className="w-7 h-7 text-cortex-danger" />
                <div>
                  <p className="text-sm font-medium text-cortex-danger">Connection Failed</p>
                  <p className="text-xs text-cortex-muted mt-1 leading-relaxed">
                    Could not connect to ZIWO.<br />Check your network or credentials.
                  </p>
                </div>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cortex-bg border border-cortex-border text-cortex-muted hover:text-cortex-text hover:border-cortex-muted transition-colors text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  )
}
