import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  UserCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { AppBrand } from "@/components/brand/app-brand"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
  disabled?: boolean
  external?: boolean
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

export interface RoleTheme {
  navActiveBg?: string
  navActiveText?: string
  navActiveIcon?: string
  navHoverBg?: string
  navHoverText?: string
  badgeBg?: string
  badgeText?: string
}

interface DashboardShellProps {
  children: React.ReactNode
  role: "admin" | "encadrant" | "stagiaire"
  navItems: NavItem[]
  navSections?: NavSection[]
  userName: string
  userRole: string
  brand?: React.ReactNode
  topTitle?: string
  topSubtitle?: string
  topActions?: React.ReactNode
  sidebarFooter?: React.ReactNode
  logoutLabel?: string
  onLogout?: () => void
  roleTheme?: Partial<Record<DashboardShellProps["role"], RoleTheme>>
}

interface NotificationRead {
  id: number
  title: string
  message: string
  category: string
  payload: string | null
  created_at: string
  read_at: string | null
}

interface NotificationUnreadCount {
  unread_count: number
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
})

const MAX_VISIBLE_NOTIFICATIONS = 3
const NOTIFICATION_ROW_HEIGHT = 96

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const source = value.includes("T") ? value : `${value}T00:00:00`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatNotificationDate(value: string | null | undefined): string {
  const parsed = parseDate(value)
  if (!parsed) {
    return "-"
  }

  const now = new Date()
  const sameDay =
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()

  return sameDay ? TIME_FORMATTER.format(parsed) : DATE_TIME_FORMATTER.format(parsed)
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

export function DashboardShell({
  children,
  role,
  navItems,
  navSections,
  userName,
  userRole,
  brand,
  topTitle,
  topSubtitle,
  topActions,
  sidebarFooter,
  logoutLabel = "DÃ©connexion",
  onLogout,
  roleTheme,
}: DashboardShellProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRead[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState("")
  const [isMarkingAllNotifications, setIsMarkingAllNotifications] = useState(false)
  const [markingNotificationId, setMarkingNotificationId] = useState<number | null>(null)
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  const [hasUnreadCountLoaded, setHasUnreadCountLoaded] = useState(false)

  const activeNavItem = useMemo(
    () =>
      navItems.find(
        (item) =>
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
      ),
    [navItems, pathname],
  )

  const unreadBadge = useMemo(() => {
    const allItems = navSections?.flatMap((section) => section.items) ?? navItems
    return allItems.find(
      (item) => item.href.includes("/messages") || item.label.toLowerCase().includes("message"),
    )?.badge
  }, [navItems, navSections])

  const unreadFallback = useMemo(() => {
    const numeric = Number(unreadBadge)
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0
  }, [unreadBadge])

  const displayedUnreadCount = hasUnreadCountLoaded ? notificationUnreadCount : unreadFallback

  const notificationsViewportHeight = useMemo(() => {
    if (notificationsLoading || notifications.length === 0) {
      return 96
    }
    return Math.min(notifications.length, MAX_VISIBLE_NOTIFICATIONS) * NOTIFICATION_ROW_HEIGHT
  }, [notifications.length, notificationsLoading])

  const resolvedSections = useMemo<NavSection[]>(
    () => (navSections?.length ? navSections : [{ label: "Navigation", items: navItems }]),
    [navItems, navSections],
  )

  const activeClasses = roleTheme?.[role]?.navActiveBg ?? "bg-transparent"
  const activeText = roleTheme?.[role]?.navActiveText ?? "text-indigo-700 font-semibold"
  const activeIcon = roleTheme?.[role]?.navActiveIcon ?? "text-indigo-600"
  const hoverBg = roleTheme?.[role]?.navHoverBg ?? "hover:bg-indigo-50/60"
  const hoverText = roleTheme?.[role]?.navHoverText ?? "hover:text-slate-900"
  const badgeBg = roleTheme?.[role]?.badgeBg ?? "bg-indigo-100/60"
  const badgeText = roleTheme?.[role]?.badgeText ?? "text-indigo-700"

  const redirectToLogin = useCallback(() => {
    clearAuthSession()
    navigate("/connexion", { replace: true })
  }, [navigate])

  const loadUnreadNotificationsCount = useCallback(async () => {
    try {
      const response = await requestAuthJson<NotificationUnreadCount>("/notifications/me/unread-count")
      setNotificationUnreadCount(response.unread_count || 0)
      setHasUnreadCountLoaded(true)
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        redirectToLogin()
      }
    }
  }, [redirectToLogin])

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true)
    setNotificationsError("")

    try {
      const response = await requestAuthJson<NotificationRead[]>("/notifications/me?limit=20")
      setNotifications(response)
      const unreadInList = response.filter((notification) => !notification.read_at).length
      setNotificationUnreadCount(unreadInList)
      setHasUnreadCountLoaded(true)
      void loadUnreadNotificationsCount()
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        redirectToLogin()
        return
      }
      setNotificationsError(asErrorMessage(error, "Chargement des notifications indisponible."))
    } finally {
      setNotificationsLoading(false)
    }
  }, [loadUnreadNotificationsCount, redirectToLogin])

  const markNotificationAsRead = useCallback(
    async (notificationId: number) => {
      const target = notifications.find((notification) => notification.id === notificationId)
      if (!target || target.read_at) {
        return
      }

      setMarkingNotificationId(notificationId)
      setNotificationsError("")
      try {
        const updated = await requestAuthJson<NotificationRead>(`/notifications/${notificationId}/read`, {
          method: "PATCH",
        })
        setNotifications((previous) =>
          previous.map((notification) =>
            notification.id === notificationId ? updated : notification,
          ),
        )
        setNotificationUnreadCount((previous) => Math.max(0, previous - 1))
        setHasUnreadCountLoaded(true)
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          redirectToLogin()
          return
        }
        setNotificationsError(asErrorMessage(error, "Mise a jour de la notification impossible."))
      } finally {
        setMarkingNotificationId((previous) => (previous === notificationId ? null : previous))
      }
    },
    [notifications, redirectToLogin],
  )

  const markAllNotificationsAsRead = useCallback(async () => {
    if (displayedUnreadCount === 0) {
      return
    }

    setIsMarkingAllNotifications(true)
    setNotificationsError("")
    try {
      await requestAuthJson<{ message: string; updated: number }>("/notifications/me/read-all", {
        method: "PATCH",
      })
      const nowIso = new Date().toISOString()
      setNotifications((previous) =>
        previous.map((notification) =>
          notification.read_at ? notification : { ...notification, read_at: nowIso },
        ),
      )
      setNotificationUnreadCount(0)
      setHasUnreadCountLoaded(true)
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        redirectToLogin()
        return
      }
      setNotificationsError(asErrorMessage(error, "Action indisponible pour le moment."))
    } finally {
      setIsMarkingAllNotifications(false)
    }
  }, [displayedUnreadCount, redirectToLogin])

  useEffect(() => {
    void loadUnreadNotificationsCount()
    const intervalId = window.setInterval(() => {
      void loadUnreadNotificationsCount()
    }, 60000)
    return () => window.clearInterval(intervalId)
  }, [loadUnreadNotificationsCount])

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-b from-indigo-50/40 via-background to-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        data-role={role}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-indigo-100/70 bg-white/95 backdrop-blur-lg transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-b border-indigo-100/70 px-5 py-4">
          <div className="flex items-center justify-between">
            {brand ? (
              <div className="flex items-center gap-3">{brand}</div>
            ) : (
              <Link
                to="/"
                className="flex items-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <AppBrand
                  logoClassName="h-8 w-8"
                  titleClassName="text-slate-900"
                  subtitleClassName="text-[11px] text-slate-500"
                  subtitle="Portail des stages"
                />
              </Link>
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-muted-foreground transition-colors hover:text-foreground lg:hidden"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Sidebar">
          {resolvedSections.map((section, sectionIndex) => (
            <div key={`${section.label || "section"}-${sectionIndex}`} className={sectionIndex > 0 ? "mt-4" : ""}>
              {section.label && (
                <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {section.label}
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(`${item.href}/`))
                  const content = (
                    <>
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                          isActive
                            ? `bg-white ${activeIcon} shadow-sm`
                            : "bg-white text-slate-400 group-hover:text-indigo-600",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <Badge className={cn("text-xs", badgeBg, badgeText, "border border-indigo-100")}>
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )

                  return (
                    <li key={item.href}>
                      {item.disabled ? (
                        <div
                          className={cn(
                            "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-slate-400 opacity-60",
                          )}
                          aria-disabled="true"
                        >
                          {content}
                        </div>
                      ) : item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "group flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? `border-transparent ${activeClasses} ${activeText}`
                              : `border-transparent text-slate-600 ${hoverBg} ${hoverText}`,
                          )}
                        >
                          {content}
                        </a>
                      ) : (
                        <Link
                          to={item.href}
                          onClick={() => setSidebarOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? `border-transparent ${activeClasses} ${activeText}`
                              : `border-transparent text-slate-600 ${hoverBg} ${hoverText}`,
                          )}
                        >
                          {content}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-indigo-100/70 p-3">
          {sidebarFooter ?? (
            onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50"
              >
                <LogOut className="h-4 w-4 text-indigo-600" />
                <span>{logoutLabel}</span>
              </button>
            ) : (
              <Link
                to="/connexion"
                className="flex items-center gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50"
              >
                <LogOut className="h-4 w-4 text-indigo-600" />
                <span>{logoutLabel}</span>
              </Link>
            )
          )}
        </div>
      </aside>

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <header className="z-10 border-b border-indigo-100/70 bg-background/90 px-5 py-3 backdrop-blur-lg">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden lg:flex lg:flex-col">
                <h1 className="text-base font-bold text-slate-900">
                  {topTitle ?? activeNavItem?.label ?? "Tableau de bord"}
                </h1>
                <p className="text-xs text-slate-500">{topSubtitle ?? userRole}</p>
              </div>
            </div>

            <div className="hidden items-center justify-center gap-3 lg:flex">
              <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-sm text-slate-700">
                <UserCircle className="h-4 w-4 text-indigo-600" />
                <span className="max-w-[140px] truncate font-semibold">{userName}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {topActions ?? (
                <>
                  <Popover
                    open={notificationsOpen}
                    onOpenChange={(open) => {
                      setNotificationsOpen(open)
                      if (open) {
                        void loadNotifications()
                        void loadUnreadNotificationsCount()
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                        <Bell className="h-4 w-4" />
                        {displayedUnreadCount > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                            {displayedUnreadCount > 99 ? "99+" : displayedUnreadCount}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[360px] p-0">
                      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Notifications</p>
                          <p className="text-xs text-muted-foreground">
                            {displayedUnreadCount} non lue(s)
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={isMarkingAllNotifications || displayedUnreadCount === 0 || notificationsLoading}
                          onClick={() => void markAllNotificationsAsRead()}
                        >
                          {isMarkingAllNotifications ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Tout lire"
                          )}
                        </Button>
                      </div>

                      {notificationsError && (
                        <div className="mx-3 mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                          {notificationsError}
                        </div>
                      )}

                      <ScrollArea style={{ height: `${notificationsViewportHeight}px` }}>
                        <div className="p-2">
                          {notificationsLoading ? (
                            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Chargement...
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                              Aucune notification.
                            </div>
                          ) : (
                            notifications.map((notification) => {
                              const isUnread = !notification.read_at
                              const isPending = markingNotificationId === notification.id

                              return (
                                <button
                                  key={notification.id}
                                  type="button"
                                  className={cn(
                                    "mb-1 w-full rounded-lg border px-3 py-2 text-left transition-colors",
                                    "min-h-[88px]",
                                    isUnread
                                      ? "border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50"
                                      : "border-border bg-card hover:bg-secondary/20",
                                  )}
                                  onClick={() => {
                                    if (isUnread && !isPending) {
                                      void markNotificationAsRead(notification.id)
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">{notification.title}</p>
                                      <p className="mt-0.5 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
                                        {notification.message}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                      ) : isUnread ? (
                                        <span className="h-2 w-2 rounded-full bg-indigo-600" aria-hidden />
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>{enumToLabel(notification.category)}</span>
                                    <span>{formatNotificationDate(notification.created_at)}</span>
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </ScrollArea>

                      <div className="border-t border-border p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-full text-xs"
                          onClick={() => void loadNotifications()}
                          disabled={notificationsLoading}
                        >
                          Rafraichir
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button variant="ghost" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="z-10 flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

export { LayoutDashboard, Users, ClipboardList, BarChart3, Settings }
