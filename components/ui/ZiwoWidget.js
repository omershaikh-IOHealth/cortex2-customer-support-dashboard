'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Script from 'next/script'
import { useSession } from 'next-auth/react'
import { getMe, logCall } from '@/lib/api'
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

  const mediaRef = useRef(null)
  const clientRef = useRef(null)
  const timerRef = useRef(null)
  const callStartRef = useRef(null)
  const currentCallRef = useRef(null)
  const initDoneRef = useRef(false)

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
      currentCallRef.current = e.detail?.currentCall
      setCallInfo({ number: e.detail?.customerNumber || 'Unknown', direction: e.detail?.direction || 'inbound' })
      setStatus(S.RINGING)
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
      currentCallRef.current = null
      setStatus(S.ENDED)
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
      <div className="fixed bottom-4 right-4 z-50 w-72 bg-cortex-surface border border-cortex-border rounded-xl shadow-2xl overflow-hidden">

        {/* Status bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-cortex-border bg-cortex-bg/50">
          <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-xs font-mono text-cortex-text flex-1 truncate">{statusLabel}</span>
          <button
            onClick={() => setMinimized(m => !m)}
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

            {/* ── Ended call summary ── */}
            {status === S.ENDED && endedInfo && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-cortex-muted font-mono uppercase tracking-wider mb-2">
                    Call Ended
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <span className="text-cortex-muted">Duration</span>
                    <span className="text-cortex-text font-mono">{fmt(endedInfo.duration)}</span>
                    <span className="text-cortex-muted">Direction</span>
                    <span className="text-cortex-text capitalize">{endedInfo.direction}</span>
                    <span className="text-cortex-muted">Number</span>
                    <span className="text-cortex-text font-mono truncate">{endedInfo.number}</span>
                    <span className="text-cortex-muted">Cause</span>
                    <span className="text-cortex-text capitalize">{endedInfo.cause}</span>
                  </div>
                </div>
                <button
                  onClick={() => setStatus(S.CONNECTED)}
                  className="w-full py-1.5 text-xs text-cortex-muted hover:text-cortex-text border border-cortex-border rounded-lg transition-colors"
                >
                  Dismiss
                </button>
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
