import AgentSidebar from '@/components/ui/AgentSidebar'
import ZiwoWidget from '@/components/ui/ZiwoWidget'
import IdleLogout from '@/components/ui/IdleLogout'

export default function AgentLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <AgentSidebar />
      <main className="flex-1 ml-52 p-6 min-h-screen">
        {children}
      </main>
      {/* ZIWO widget — fixed bottom-right, always available */}
      <ZiwoWidget contactCenterName={process.env.ZIWO_CC_NAME || 'iohealth'} />
      {/* 10-min idle auto-logoff for agents */}
      <IdleLogout />
    </div>
  )
}
