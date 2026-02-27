import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const ADMIN_PATHS = ['/dashboard', '/tickets', '/sla', '/escalations', '/analytics', '/qa', '/logs', '/admin', '/agent-status', '/rota']

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Always allow: auth API, setup endpoint, static assets
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/setup') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Login page: redirect already-authenticated users to their home
  if (pathname === '/login') {
    if (session) {
      const dest = session.user?.role === 'admin' ? '/dashboard' : '/briefing'
      return NextResponse.redirect(new URL(dest, req.url))
    }
    return NextResponse.next()
  }

  // API routes without session → JSON 401 (not a login redirect)
  if (!session && pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // All other non-API routes require authentication
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin-only paths: redirect agents to their home
  const isAdminPath = ADMIN_PATHS.some(
    p => pathname === p || pathname.startsWith(p + '/')
  )
  // Allow agents to access individual ticket detail pages (linked from my-tickets)
  const isTicketDetailPage = /^\/tickets\/\d+$/.test(pathname)
  if (isAdminPath && !isTicketDetailPage && session.user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/briefing', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
