'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Lock, AlertTriangle, Clock } from 'lucide-react'

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
        // NextAuth wraps thrown errors — check for LOCKED prefix
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
    } catch (err) {
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
    <div className="min-h-screen bg-cortex-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-cortex-accent to-blue-400 bg-clip-text text-transparent">
            CORTEX 2.0
          </h1>
          <p className="text-cortex-muted mt-2 font-mono text-sm tracking-wide">
            Support Center Operations
          </p>
        </div>

        {/* Card */}
        <div className="bg-cortex-surface border border-cortex-border rounded-xl p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-cortex-text mb-1">Sign in</h2>
          <p className="text-sm text-cortex-muted mb-6">Enter your io Health credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-cortex-muted mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input w-full"
                placeholder="you@iohealth.com"
                required
                autoFocus
                autoComplete="email"
                disabled={!!lockedUntil}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-cortex-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input w-full"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={!!lockedUntil}
              />
              <p className="text-xs text-cortex-muted mt-1.5">
                Min 8 characters · uppercase · lowercase · number or symbol
              </p>
            </div>

            {/* Error states */}
            {lockedUntil && (
              <div className="text-cortex-warning text-sm bg-cortex-warning/10 border border-cortex-warning/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <Lock className="w-4 h-4 shrink-0" />
                  Account temporarily locked
                </div>
                <div className="flex items-center gap-1.5 text-xs text-cortex-muted">
                  <Clock className="w-3 h-3" />
                  Try again in {fmtLockTime(lockedUntil)}. Contact your admin if you need immediate access.
                </div>
              </div>
            )}

            {error && (
              <div className="text-cortex-danger text-sm bg-cortex-danger/10 border border-cortex-danger/20 rounded-lg px-4 py-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!lockedUntil}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
