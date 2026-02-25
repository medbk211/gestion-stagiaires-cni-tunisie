import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  MessageSquare,
  Settings,
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

interface StagiaireProfileResponse {
  id: number
  nom: string
  prenom: string
  email: string
  role: string
  niveau_etude: string | null
}

interface NotificationUnreadCount {
  unread_count: number
}

interface UseStagiaireSidebarResult {
  navItems: NavItem[]
  userName: string
  userRole: string
  isSidebarLoading: boolean
  sidebarWarning: string
  refreshSidebar: (options?: { silent?: boolean }) => Promise<void>
  documentsCount: number
  unreadCount: number
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

function buildStagiaireNavItems(documentsCount: number, unreadCount: number): NavItem[] {
  return [
    { label: "Tableau de bord", href: "/dashboard/stagiaire", icon: LayoutDashboard },
    { label: "Mon Projet", href: "/dashboard/stagiaire/stage", icon: Briefcase },
    { label: "Taches Kanban", href: "/dashboard/stagiaire/taches", icon: KanbanSquare },
    {
      label: "Documents",
      href: "/dashboard/stagiaire/documents",
      icon: FileText,
      badge: documentsCount > 0 ? String(documentsCount) : undefined,
    },
    {
      id: "calendar",
      label: "Calendrier",
      href: "/dashboard/stagiaire/calendar",
      icon: CalendarDays,
    },
    { label: "Journal de bord", href: "/dashboard/stagiaire/journal", icon: BookOpen },
    {
      label: "Messages",
      href: "/dashboard/stagiaire/messages",
      icon: MessageSquare,
      badge: unreadCount > 0 ? String(unreadCount) : undefined,
    },
    { label: "Parametres", href: "/dashboard/stagiaire/settings", icon: Settings },
  ]
}

function resolveUserName(currentUser: CurrentUserResponse | null, profile: StagiaireProfileResponse | null): string {
  const fromProfile = `${profile?.prenom || ""} ${profile?.nom || ""}`.trim()
  if (fromProfile) {
    return fromProfile
  }

  const fromUser = `${currentUser?.prenom || ""} ${currentUser?.nom || ""}`.trim()
  if (fromUser) {
    return fromUser
  }

  const fromStorage = localStorage.getItem("cni_user_name") || ""
  return fromStorage.trim() || "Stagiaire"
}

function resolveUserRole(currentUser: CurrentUserResponse | null, profile: StagiaireProfileResponse | null): string {
  const studyLevel = enumToLabel(profile?.niveau_etude)
  if (studyLevel !== "-") {
    return `Stagiaire ${studyLevel}`
  }

  const roleValue = profile?.role || currentUser?.role || localStorage.getItem("cni_user_role")
  const roleLabel = enumToLabel(roleValue)
  return roleLabel !== "-" ? roleLabel : "Stagiaire"
}

export function useStagiaireSidebar(): UseStagiaireSidebarResult {
  const navigate = useNavigate()

  const [userName, setUserName] = useState(() => (localStorage.getItem("cni_user_name") || "").trim() || "Stagiaire")
  const [userRole, setUserRole] = useState(() => {
    const roleFromStorage = localStorage.getItem("cni_user_role")
    const roleLabel = enumToLabel(roleFromStorage)
    return roleLabel !== "-" ? roleLabel : "Stagiaire"
  })

  const [documentsCount, setDocumentsCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isSidebarLoading, setIsSidebarLoading] = useState(true)
  const [sidebarWarning, setSidebarWarning] = useState("")

  const refreshSidebar = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true
      if (!silent) {
        setIsSidebarLoading(true)
      }
      setSidebarWarning("")

      const accessToken = localStorage.getItem("cni_access_token")
      if (!accessToken) {
        clearAuthSession()
        setIsSidebarLoading(false)
        navigate("/connexion", { replace: true })
        return
      }

      try {
        const [meResult, profileResult, documentsResult, unreadCountResult] = await Promise.allSettled([
          requestAuthJson<CurrentUserResponse>("/auth/me"),
          requestAuthJson<StagiaireProfileResponse>("/stagiaires/me/profile"),
          requestAuthJson<Array<{ id: number }>>("/documents/me"),
          requestAuthJson<NotificationUnreadCount>("/notifications/me/unread-count?category=message_interne"),
        ] as const)

        if (
          [meResult, profileResult, documentsResult, unreadCountResult].some(
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

        const nextProfile = profileResult.status === "fulfilled" ? profileResult.value : null
        if (profileResult.status === "rejected" && !isApiErrorStatus(profileResult.reason, 404)) {
          warnings.push(`Profil stagiaire: ${asErrorMessage(profileResult.reason, "indisponible")}`)
        }

        const nextDocumentsCount = documentsResult.status === "fulfilled" ? documentsResult.value.length : 0
        if (documentsResult.status === "rejected") {
          warnings.push(`Documents: ${asErrorMessage(documentsResult.reason, "indisponibles")}`)
        }

        const nextUnreadCount = unreadCountResult.status === "fulfilled" ? unreadCountResult.value.unread_count : 0
        if (unreadCountResult.status === "rejected") {
          warnings.push(`Notifications: ${asErrorMessage(unreadCountResult.reason, "indisponibles")}`)
        }

        if (nextCurrentUser) {
          localStorage.setItem("cni_user_email", nextCurrentUser.email)
          localStorage.setItem("cni_user_name", `${nextCurrentUser.prenom} ${nextCurrentUser.nom}`.trim())
        }

        if (nextProfile?.role) {
          localStorage.setItem("cni_user_role", nextProfile.role)
        } else if (nextCurrentUser?.role) {
          localStorage.setItem("cni_user_role", nextCurrentUser.role)
        }

        setUserName(resolveUserName(nextCurrentUser, nextProfile))
        setUserRole(resolveUserRole(nextCurrentUser, nextProfile))
        setDocumentsCount(nextDocumentsCount)
        setUnreadCount(nextUnreadCount)
        setSidebarWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setSidebarWarning(asErrorMessage(error, "Chargement du sidebar indisponible pour le moment."))
      } finally {
        if (!silent) {
          setIsSidebarLoading(false)
        }
      }
    },
    [navigate],
  )

  useEffect(() => {
    void refreshSidebar()
  }, [refreshSidebar])

  const navItems = useMemo(() => buildStagiaireNavItems(documentsCount, unreadCount), [documentsCount, unreadCount])

  return {
    navItems,
    userName,
    userRole,
    isSidebarLoading,
    sidebarWarning,
    refreshSidebar,
    documentsCount,
    unreadCount,
  }
}
