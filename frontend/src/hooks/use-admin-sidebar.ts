import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Briefcase,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  Settings,
  UserPlus,
  Users,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { NavItem } from "@/components/dashboard/dashboard-shell"
import { ApiError, authApi, clearAuthSession, statisticsApi } from "@/api"

interface CurrentUserResponse {
  id: number
  email: string
  nom: string
  prenom: string
  role: string
}

interface StatutCount {
  statut: string
  count: number
}

interface DashboardStatsRead {
  totaux: {
    demandes: number
    stagiaires: number
    encadreurs: number
    documents: number
    affectations: number
    projets: number
  }
  demandes_par_statut: StatutCount[]
}

interface UseAdminSidebarResult {
  navItems: NavItem[]
  userName: string
  userRole: string
  pendingDemandesCount: number
  sidebarWarning: string
  refreshSidebar: (options?: { silent?: boolean }) => Promise<void>
}

function enumToLabel(value: string | null | undefined): string {
  if (!value) {
    return "-"
  }
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function findPendingDemandesCount(items: StatutCount[]): number {
  const match = items.find((item) => (item.statut || "").toUpperCase() === "EN_ATTENTE")
  return match?.count || 0
}

function buildAdminNavItems(pendingDemandesCount: number): NavItem[] {
  return [
    { label: "Tableau de bord", href: "/dashboard/admin", icon: LayoutDashboard },
    {
      label: "Candidatures",
      href: "/dashboard/admin/candidatures",
      icon: ClipboardList,
      badge: pendingDemandesCount > 0 ? String(pendingDemandesCount) : undefined,
    },
    { label: "Stagiaires", href: "/dashboard/admin/stagiaires", icon: Users },
    { label: "Encadrants", href: "/dashboard/admin/encadrants", icon: UserPlus },
    { label: "Projets", href: "/dashboard/admin/projets", icon: Briefcase },
    { label: "Attestations", href: "/dashboard/admin/attestations", icon: FileCheck2 },
    { label: "Statistiques", href: "/dashboard/admin/stats", icon: BarChart3 },
    { label: "Parametres", href: "/dashboard/admin/settings", icon: Settings },
  ]
}

export function useAdminSidebar(): UseAdminSidebarResult {
  const navigate = useNavigate()

  const [userName, setUserName] = useState(() => (localStorage.getItem("cni_user_name") || "").trim() || "Administrateur")
  const [userRole, setUserRole] = useState(() => {
    const roleLabel = enumToLabel(localStorage.getItem("cni_user_role"))
    return roleLabel !== "-" ? roleLabel : "Administrateur"
  })
  const [pendingDemandesCount, setPendingDemandesCount] = useState(0)
  const [sidebarWarning, setSidebarWarning] = useState("")

  const refreshSidebar = useCallback(
    async (_options?: { silent?: boolean }) => {
      setSidebarWarning("")

      const accessToken = localStorage.getItem("cni_access_token")
      if (!accessToken) {
        clearAuthSession()
        navigate("/connexion", { replace: true })
        return
      }

      try {
        const [meResult, statsResult] = await Promise.allSettled([
          authApi.me<CurrentUserResponse>(),
          statisticsApi.dashboard<DashboardStatsRead>(),
        ] as const)

        if (
          [meResult, statsResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        const warnings: string[] = []

        const nextCurrentUser = meResult.status === "fulfilled" ? meResult.value : null
        if (meResult.status === "rejected") {
          warnings.push(`Utilisateur: ${asErrorMessage(meResult.reason, "indisponible")}`)
        }

        const nextPendingDemandesCount = statsResult.status === "fulfilled"
          ? findPendingDemandesCount(statsResult.value.demandes_par_statut || [])
          : 0
        if (statsResult.status === "rejected") {
          warnings.push(`Statistiques: ${asErrorMessage(statsResult.reason, "indisponibles")}`)
        }

        if (nextCurrentUser) {
          localStorage.setItem("cni_user_email", nextCurrentUser.email)
          localStorage.setItem("cni_user_name", `${nextCurrentUser.prenom} ${nextCurrentUser.nom}`.trim())
          localStorage.setItem("cni_user_role", nextCurrentUser.role)
          setUserName(`${nextCurrentUser.prenom} ${nextCurrentUser.nom}`.trim() || "Administrateur")
          const roleLabel = enumToLabel(nextCurrentUser.role)
          setUserRole(roleLabel !== "-" ? roleLabel : "Administrateur")
        }

        setPendingDemandesCount(nextPendingDemandesCount)
        setSidebarWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setSidebarWarning(asErrorMessage(error, "Chargement du sidebar indisponible pour le moment."))
      }
    },
    [navigate],
  )

  useEffect(() => {
    void refreshSidebar()
  }, [refreshSidebar])

  const navItems = useMemo(
    () => buildAdminNavItems(pendingDemandesCount),
    [pendingDemandesCount],
  )

  return {
    navItems,
    userName,
    userRole,
    pendingDemandesCount,
    sidebarWarning,
    refreshSidebar,
  }
}
