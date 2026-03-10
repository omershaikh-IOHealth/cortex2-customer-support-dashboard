import { NextResponse } from 'next/server'

/**
 * POST /api/auth/logout
 *
 * Called via navigator.sendBeacon when an agent closes their browser tab.
 * Expires the NextAuth session cookie so the next browser open requires login.
 * Works for both development (http) and production (https / __Secure- prefix).
 */
export async function POST() {
  const res = NextResponse.json({ ok: true })

  // Expire all NextAuth v5 / Auth.js session cookie variants
  const cookieOpts = { maxAge: 0, httpOnly: true, sameSite: 'lax', path: '/' }
  const secureCookieOpts = { ...cookieOpts, secure: true }

  res.cookies.set('authjs.session-token',           '', cookieOpts)
  res.cookies.set('next-auth.session-token',         '', cookieOpts)
  res.cookies.set('__Secure-authjs.session-token',   '', secureCookieOpts)
  res.cookies.set('__Secure-next-auth.session-token','', secureCookieOpts)

  return res
}
