import { auth } from '@/auth'
import Sidebar from '@/components/ui/Sidebar'
import AICompanion from '@/components/ui/AICompanion'
import TopAlertBar from '@/components/ui/TopAlertBar'
import AgentSidebar from '@/components/ui/AgentSidebar'
import ZiwoWidget from '@/components/ui/ZiwoWidget'
import IdleLogout from '@/components/ui/IdleLogout'

export default async function KnowledgeBaseLayout({ children }) {
  const session = await auth()
  const isAdmin = session?.user?.role === 'admin'

  if (isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col min-h-screen">
          <TopAlertBar />
          <main className="flex-1 p-8">{children}</main>
        </div>
        <AICompanion />
      </div>
    )
  }

  // Agent layout
  return (
    <div className="flex min-h-screen">
      <AgentSidebar />
      <main className="flex-1 ml-52 p-6 min-h-screen">{children}</main>
      <ZiwoWidget contactCenterName={process.env.ZIWO_CC_NAME || 'iohealth'} />
      <IdleLogout />
    </div>
  )
}
