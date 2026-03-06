import AgentSidebar from '@/components/ui/AgentSidebar'
import AICompanion from '@/components/ui/AICompanion'

export default function AgentLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <AgentSidebar />
      <main className="flex-1 ml-52 p-6 min-h-screen">
        {children}
      </main>
      {/* AI Companion — sits to the left of ZIWO by default, draggable */}
      <AICompanion />
      {/* ZiwoWidget + IdleLogout are mounted at root layout level (PersistentAgentWidgets)
          so they survive navigation to /pocs, /notifications, /knowledge-base etc. */}
    </div>
  )
}
