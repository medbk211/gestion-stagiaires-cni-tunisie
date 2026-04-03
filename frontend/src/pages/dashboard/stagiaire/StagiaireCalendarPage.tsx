import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Clock3,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useStagiaireSidebar } from "@/hooks/use-stagiaire-sidebar"

interface StageRead {
  id: number
  date_debut: string
  date_fin: string
  texte_objectif: string
  statut_stage: string
  stagiaire_id: number
  encadreur_id: number
  projet_id: number | null
}

interface TaskRead {
  id: number
  title: string
  description: string | null
  priority: string
  deadline: string | null
  project_id: number
  stage_id: number
  status: string
  created_at: string
  updated_at: string
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

interface AgendaItem {
  id: string
  title: string
  date: string
  helper: string
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const source = value.includes("T") ? value : `${value}T00:00:00`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function formatDate(value: string | null | undefined): string {
  const parsed = parseDate(value)
  return parsed ? DATE_FORMATTER.format(parsed) : "-"
}

function formatDateTime(value: string | null | undefined): string {
  const parsed = parseDate(value)
  return parsed ? DATE_TIME_FORMATTER.format(parsed) : "-"
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

function isMeetingNotification(notification: NotificationRead): boolean {
  const haystack = `${notification.category} ${notification.title} ${notification.message}`.toLowerCase()
  return (
    haystack.includes("reunion") ||
    haystack.includes("meeting") ||
    haystack.includes("rendez") ||
    haystack.includes("appointment")
  )
}

export default function StagiaireCalendarPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useStagiaireSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")

  const [stage, setStage] = useState<StageRead | null>(null)
  const [tasks, setTasks] = useState<TaskRead[]>([])
  const [notifications, setNotifications] = useState<NotificationRead[]>([])

  const loadCalendar = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true
      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setPageError("")
      setDataWarning("")

      const accessToken = localStorage.getItem("cni_access_token")
      if (!accessToken) {
        if (silent) {
          setIsRefreshing(false)
        } else {
          setIsLoading(false)
        }
        navigate("/connexion", { replace: true })
        return
      }

      try {
        const [stageResult, tasksResult, notificationsResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<StageRead>("/Stages/me"),
          requestAuthJson<TaskRead[]>("/tasks/my-tasks"),
          requestAuthJson<NotificationRead[]>("/notifications/me?limit=60"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [stageResult, tasksResult, notificationsResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        const warnings: string[] = []

        const nextStage = stageResult.status === "fulfilled" ? stageResult.value : null
        if (stageResult.status === "rejected" && !isApiErrorStatus(stageResult.reason, 404)) {
          warnings.push(`Stage: ${asErrorMessage(stageResult.reason, "indisponible")}`)
        }

        const nextTasks = tasksResult.status === "fulfilled" ? tasksResult.value : []
        if (tasksResult.status === "rejected") {
          warnings.push(`Deadlines: ${asErrorMessage(tasksResult.reason, "indisponibles")}`)
        }

        const nextNotifications = notificationsResult.status === "fulfilled" ? notificationsResult.value : []
        if (notificationsResult.status === "rejected") {
          warnings.push(`Reunions: ${asErrorMessage(notificationsResult.reason, "indisponibles")}`)
        }

        if (sidebarResult.status === "rejected") {
          warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        setStage(nextStage)
        setTasks(nextTasks)
        setNotifications(nextNotifications)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement de la planification impossible pour le moment."))
      } finally {
        if (silent) {
          setIsRefreshing(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [navigate, refreshSidebar],
  )

  useEffect(() => {
    void loadCalendar()
  }, [loadCalendar])

  const appointments = useMemo<AgendaItem[]>(() => {
    const items: AgendaItem[] = []
    if (stage?.date_debut) {
      items.push({
        id: `stage-start-${stage.id}`,
        title: "Debut de stage",
        date: stage.date_debut,
        helper: enumToLabel(stage.statut_stage),
      })
    }
    if (stage?.date_fin) {
      items.push({
        id: `stage-end-${stage.id}`,
        title: "Fin de stage",
        date: stage.date_fin,
        helper: enumToLabel(stage.statut_stage),
      })
    }
    return items.sort((a, b) => (parseDate(a.date)?.getTime() || 0) - (parseDate(b.date)?.getTime() || 0))
  }, [stage])

  const deadlines = useMemo(() => {
    return [...tasks]
      .filter((task) => Boolean(task.deadline))
      .sort((a, b) => (parseDate(a.deadline)?.getTime() || 0) - (parseDate(b.deadline)?.getTime() || 0))
      .map((task) => {
        const deadline = parseDate(task.deadline)
        const isDone = (task.status || "").toLowerCase() === "done" || (task.status || "").toLowerCase() === "validated"
        const isOverdue = deadline ? !isDone && deadline.getTime() < Date.now() : false
        return { ...task, isDone, isOverdue }
      })
  }, [tasks])

  const meetings = useMemo(() => {
    return notifications
      .filter((notification) => isMeetingNotification(notification))
      .sort((a, b) => (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0))
      .slice(0, 10)
  }, [notifications])

  return (
    <DashboardShell role="stagiaire" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Planification"
          subtitle="مواعيد • Deadlines • Réunions"
          actions={(
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => void loadCalendar({ silent: true })}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Actualiser
            </Button>
          )}
        />

        {pageError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {pageError}
          </div>
        )}

        {sidebarWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {sidebarWarning}
          </div>
        )}

        {dataWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {dataWarning}
          </div>
        )}

        {isLoading ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement de la planification...
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-indigo-600" />
                  مواعيد
                </CardTitle>
                <CardDescription>Rendez-vous principaux du stage</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {appointments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                    Aucun rendez-vous disponible.
                  </div>
                ) : (
                  appointments.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(item.date)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.helper}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock3 className="h-4 w-4 text-amber-600" />
                  Deadlines
                </CardTitle>
                <CardDescription>Dates limites de vos taches</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {deadlines.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                    Aucune deadline disponible.
                  </div>
                ) : (
                  deadlines.slice(0, 10).map((task) => (
                    <div key={task.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                        {task.isDone ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Done</Badge>
                        ) : task.isOverdue ? (
                          <Badge className="border-red-200 bg-red-50 text-red-700">Overdue</Badge>
                        ) : (
                          <Badge variant="outline">A venir</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(task.deadline)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-blue-600" />
                  Réunions
                </CardTitle>
                <CardDescription>Messages et alertes de type reunion</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {meetings.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                    Aucune reunion detectee.
                  </div>
                ) : (
                  meetings.map((meeting) => (
                    <div key={meeting.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{meeting.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(meeting.created_at)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
