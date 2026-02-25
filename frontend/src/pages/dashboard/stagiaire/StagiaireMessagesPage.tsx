import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MessagesWorkspace } from "@/components/dashboard/messages-workspace"
import { useStagiaireSidebar } from "@/hooks/use-stagiaire-sidebar"

export default function StagiaireMessagesPage() {
  const { navItems, userName, userRole, sidebarWarning } = useStagiaireSidebar()

  return (
    <DashboardShell role="stagiaire" navItems={navItems} userName={userName} userRole={userRole}>
      <MessagesWorkspace
        title="Messages"
        subtitle="Communiquer avec votre encadreur"
        sidebarWarning={sidebarWarning}
      />
    </DashboardShell>
  )
}
