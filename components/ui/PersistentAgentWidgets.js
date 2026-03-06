'use client'

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

  // Only render for authenticated agents
  if (status !== 'authenticated' || session?.user?.role !== 'agent') return null

  return (
    <>
      <ZiwoWidget contactCenterName={process.env.NEXT_PUBLIC_ZIWO_CC_NAME || 'iohealth'} />
      <IdleLogout />
    </>
  )
}
