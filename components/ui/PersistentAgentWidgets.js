'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

// Dynamic imports avoid SSR issues for these heavy client-only widgets
const ZiwoWidget = dynamic(() => import('./ZiwoWidget'), { ssr: false })
const IdleLogout = dynamic(() => import('./IdleLogout'), { ssr: false })

/**
 * Mounted once at the root layout level so these widgets survive
 * ALL page navigations — including to /pocs, /notifications, /knowledge-base
 * which live outside the (agent) route group and would otherwise unmount
 * the agent layout and kill the ZIWO WebSocket connection.
 */
export default function PersistentAgentWidgets() {
  const { data: session, status } = useSession()
  const isAgent = status === 'authenticated' && session?.user?.role === 'agent'

  /**
   * Browser-close logout (agents only).
   *
   * When an agent closes the browser tab/window, navigator.sendBeacon posts to
   * /api/auth/logout which expires the session cookie. The next time the browser
   * is opened the cookie is gone → redirect to login.
   *
   * Note: `beforeunload` fires on tab close AND hard refresh (F5). Client-side
   * navigation in Next.js does NOT trigger beforeunload, so internal page
   * changes are unaffected. Hard refresh will log the agent out — acceptable
   * trade-off for an internal support centre tool.
   *
   * Admins are intentionally excluded (isAgent check) so they stay logged in.
   */
  useEffect(() => {
    if (!isAgent) return

    function handleBeforeUnload() {
      navigator.sendBeacon('/api/auth/logout')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isAgent])

  // Only render widgets for authenticated agents
  if (!isAgent) return null

  return (
    <>
      <ZiwoWidget contactCenterName={process.env.NEXT_PUBLIC_ZIWO_CC_NAME || 'iohealth'} />
      <IdleLogout />
    </>
  )
}
