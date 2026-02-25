import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MessagesWorkspace } from "@/components/dashboard/messages-workspace"
import { useEncadrantSidebar } from "@/hooks/use-encadrant-sidebar"

export default function EncadrantMessagesPage() {
  const { navItems, userName, userRole, sidebarWarning } = useEncadrantSidebar()

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <MessagesWorkspace
        title="Messages"
        subtitle="Communiquer avec vos stagiaires"
        sidebarWarning={sidebarWarning}
      />
    </DashboardShell>
  )
}
