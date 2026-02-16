'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/dashboard')
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cortex-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-cortex-muted">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}