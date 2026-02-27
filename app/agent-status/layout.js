import Sidebar from '@/components/ui/Sidebar'
import AICompanion from '@/components/ui/AICompanion'
import TopAlertBar from '@/components/ui/TopAlertBar'

export default function AgentStatusLayout({ children }) {
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
