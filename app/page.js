'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
    } else if (session.user?.role === 'agent') {
      router.push('/briefing')
    } else {
      router.push('/dashboard')
    }
  }, [session, status, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-cortex-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-cortex-muted text-sm font-mono">Loading Cortex…</p>
      </div>
    </div>
  )
}
