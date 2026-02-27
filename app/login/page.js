'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Lock, AlertTriangle, Clock, RadioTower } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [lockedUntil, setLockedUntil] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLockedUntil(null)
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        if (result.error.includes('LOCKED:')) {
          const until = result.error.split('LOCKED:')[1]
          setLockedUntil(new Date(until))
        } else {
          setError('Invalid email or password. Please check your credentials and try again.')
        }
        setLoading(false)
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  function fmtLockTime(date) {
    if (!date) return ''
    const diff = Math.max(0, Math.ceil((date - Date.now()) / 60000))
    return diff <= 1 ? 'less than a minute' : `${diff} minutes`
  }

  return (
    <div className="min-h-screen bg-cortex-bg flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background gradient orbs */}
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgb(var(--cortex-accent) / 0.08) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgb(var(--cortex-accent) / 0.04) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-sm relative">

        {/* Logo / wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cortex-accent text-white mb-4 shadow-lg"
               style={{ boxShadow: '0 8px 24px rgb(var(--cortex-accent) / 0.35)' }}>
            <RadioTower className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-display font-bold text-cortex-text tracking-tight">
            Cortex <span className="text-cortex-accent">2.0</span>
          </h1>
          <p className="text-cortex-muted mt-1.5 text-sm">
            Support Center Operations · io Health
          </p>
        </div>

        {/* Card */}
        <div className="bg-cortex-surface border border-cortex-border rounded-2xl p-8"
             style={{ boxShadow: '0 8px 40px rgb(0 0 0 / 0.08), 0 2px 8px rgb(0 0 0 / 0.04)' }}>

          <h2 className="text-base font-semibold text-cortex-text mb-0.5">Sign in to your account</h2>
          <p className="text-sm text-cortex-muted mb-6">Enter your io Health credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@iohealth.com"
                required
                autoFocus
                autoComplete="email"
                disabled={!!lockedUntil}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cortex-muted uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={!!lockedUntil}
              />
            </div>

            {/* Error states */}
            {lockedUntil && (
              <div className="text-cortex-warning text-sm bg-cortex-warning/8 border border-cortex-warning/20 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  Account temporarily locked
                </div>
                <div className="flex items-center gap-1.5 text-xs text-cortex-muted">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  Try again in {fmtLockTime(lockedUntil)}. Contact your admin if needed.
                </div>
              </div>
            )}

            {error && (
              <div className="text-cortex-danger text-sm bg-cortex-danger/8 border border-cortex-danger/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!lockedUntil}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-cortex-muted text-xs mt-6 font-mono">
          Cortex 2.0 · io Health · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
