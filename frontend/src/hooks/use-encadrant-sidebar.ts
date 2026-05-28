import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Calendar,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Star,
  Users,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { NavItem } from "@/components/dashboard/dashboard-shell"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"

interface CurrentUserResponse {
  id: number
  email: string
  nom: string
  prenom: string
  role: string
}

interface NotificationUnreadCount {
  unread_count: number
}

interface EncadreurOverviewRead {
  totaux: {
    tasks_in_review: number
  }
}

interface UseEncadrantSidebarResult {
  navItems: NavItem[]
  userName: string
  userRole: string
  unreadCount: number
  internsCount: number
  tasksInReviewCount: number
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

function buildEncadrantNavItems(
  unreadCount: number,
  internsCount: number,
  tasksInReviewCount: number,
): NavItem[] {
  return [
    { label: "Tableau de bord", href: "/dashboard/encadrant", icon: LayoutDashboard },
    {
      label: "Mes Stagiaires",
      href: "/dashboard/encadrant/stagiaires",
      icon: Users,
      badge: internsCount > 0 ? String(internsCount) : undefined,
    },
    {
      label: "Taches",
      href: "/dashboard/encadrant/taches",
      icon: ClipboardList,
      badge: tasksInReviewCount > 0 ? String(tasksInReviewCount) : undefined,
    },
    { label: "Evaluations", href: "/dashboard/encadrant/evaluations", icon: Star },
    { label: "Planification", href: "/dashboard/encadrant/planning", icon: Calendar },
    {
      label: "Messages",
      href: "/dashboard/encadrant/messages",
      icon: MessageSquare,
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    { label: "Parametres", href: "/dashboard/encadrant/settings", icon: Settings },
  ]
}

function resolveUserName(currentUser: CurrentUserResponse | null): string {
  const fromUser = `${currentUser?.prenom || ""} ${currentUser?.nom || ""}`.trim()
  if (fromUser) {
    return fromUser
  }
  const fromStorage = localStorage.getItem("stages_user_name") || ""
  return fromStorage.trim() || "Encadrant"
}

function resolveUserRole(currentUser: CurrentUserResponse | null): string {
  const roleLabel = enumToLabel(currentUser?.role || localStorage.getItem("stages_user_role"))
  return roleLabel !== "-" ? roleLabel : "Encadrant"
}

export function useEncadrantSidebar(): UseEncadrantSidebarResult {
  const navigate = useNavigate()

  const [unreadCount, setUnreadCount] = useState(0)
  const [internsCount, setInternsCount] = useState(0)
  const [tasksInReviewCount, setTasksInReviewCount] = useState(0)
  const [userName, setUserName] = useState(() => (localStorage.getItem("stages_user_name") || "").trim() || "Encadrant")
  const [userRole, setUserRole] = useState(() => {
    const roleFromStorage = localStorage.getItem("stages_user_role")
    const roleLabel = enumToLabel(roleFromStorage)
    return roleLabel !== "-" ? roleLabel : "Encadrant"
  })
  const [sidebarWarning, setSidebarWarning] = useState("")

  const refreshSidebar = useCallback(
    async (_options?: { silent?: boolean }) => {
      setSidebarWarning("")

      const accessToken = localStorage.getItem("stages_access_token")
      if (!accessToken) {
        clearAuthSession()
        navigate("/connexion", { replace: true })
        return
      }

      try {
        const [meResult, unreadCountResult, internsResult, overviewResult] = await Promise.allSettled([
          requestAuthJson<CurrentUserResponse>("/auth/me"),
          requestAuthJson<NotificationUnreadCount>("/notifications/me/unread-count?category=message_interne"),
          requestAuthJson<Array<{ id: number }>>("/encadreur/me/stagiaires"),
          requestAuthJson<EncadreurOverviewRead>("/statistiques/encadreur/overview"),
        ] as const)

        if (
          [meResult, unreadCountResult, internsResult, overviewResult].some(
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

        const nextUnreadCount = unreadCountResult.status === "fulfilled" ? unreadCountResult.value.unread_count : 0
        if (unreadCountResult.status === "rejected") {
          warnings.push(`Notifications: ${asErrorMessage(unreadCountResult.reason, "indisponibles")}`)
        }

        const nextInternsCount = internsResult.status === "fulfilled" ? internsResult.value.length : 0
        if (internsResult.status === "rejected") {
          warnings.push(`Stagiaires: ${asErrorMessage(internsResult.reason, "indisponibles")}`)
        }

        const nextTasksInReviewCount = overviewResult.status === "fulfilled"
          ? overviewResult.value.totaux.tasks_in_review
          : 0
        if (overviewResult.status === "rejected") {
          warnings.push(`Taches: ${asErrorMessage(overviewResult.reason, "indisponibles")}`)
        }

        if (nextCurrentUser) {
          localStorage.setItem("stages_user_email", nextCurrentUser.email)
          localStorage.setItem("stages_user_name", `${nextCurrentUser.prenom} ${nextCurrentUser.nom}`.trim())
          if (nextCurrentUser.role) {
            localStorage.setItem("stages_user_role", nextCurrentUser.role)
          }
        }

        setUserName(resolveUserName(nextCurrentUser))
        setUserRole(resolveUserRole(nextCurrentUser))
        setUnreadCount(nextUnreadCount)
        setInternsCount(nextInternsCount)
        setTasksInReviewCount(nextTasksInReviewCount)
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
    () => buildEncadrantNavItems(unreadCount, internsCount, tasksInReviewCount),
    [internsCount, tasksInReviewCount, unreadCount],
  )

  return {
    navItems,
    userName,
    userRole,
    unreadCount,
    internsCount,
    tasksInReviewCount,
    sidebarWarning,
    refreshSidebar,
  }
}
