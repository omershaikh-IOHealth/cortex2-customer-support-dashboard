'use client'

import { useSession, signIn, signOut } from 'next-auth/react'

/**
 * Drop-in replacement for the old mock useAuth hook.
 * Now backed by NextAuth v5 JWT sessions.
 */
export function useAuth() {
  const { data: session, status } = useSession()

  return {
    user: session?.user ?? null,
    loading: status === 'loading',
    login: (email, password) =>
      signIn('credentials', { email, password, redirect: false }),
    logout: () => signOut({ callbackUrl: '/login' }),
  }
}

/**
 * Authenticated fetch — passes session cookie automatically.
 * Uses relative paths (no hardcoded localhost).
 */
export async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'API request failed')
  }

  return response.json()
}
