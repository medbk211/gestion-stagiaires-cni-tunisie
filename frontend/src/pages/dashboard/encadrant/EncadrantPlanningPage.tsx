import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Calendar,
  Clock,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useEncadrantSidebar } from "@/hooks/use-encadrant-sidebar"

interface PlanningEventRead {
  id: number
  title: string
  description: string | null
  event_type: string
  priority: string
  attendee_name: string | null
  location: string | null
  start_at: string
  end_at: string | null
  stagiaire_id: number | null
  encadreur_id: number
  created_at: string
  updated_at: string
}

interface PlanningDeadlineRead {
  task_id: number
  title: string
  deadline: string
  priority: string
  status: string
  stagiaire_id: number | null
  stagiaire_nom_complet: string | null
  stage_id: number
}

interface PlanningWeekOverview {
  week_start: string
  week_end: string
  events: PlanningEventRead[]
  deadlines: PlanningDeadlineRead[]
}

interface AgendaItem {
  id: string
  title: string
  type: string
  startAt: string
  endAt: string | null
  helper: string
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

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
})

const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
})

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  meeting: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Reunion" },
  review: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Review" },
  visit: { color: "bg-violet-100 text-violet-700 border-violet-200", label: "Visite" },
  deadline: { color: "bg-red-100 text-red-700 border-red-200", label: "Deadline" },
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const source = value.includes("T") ? value : `${value}T00:00:00`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(value: string | null | undefined): string {
  const parsed = parseDate(value)
  return parsed ? DATE_FORMATTER.format(parsed) : "-"
}

function formatDateTime(value: string | null | undefined): string {
  const parsed = parseDate(value)
  return parsed ? DATE_TIME_FORMATTER.format(parsed) : "-"
}

function toDayKey(value: string | null | undefined): string | null {
  const parsed = parseDate(value)
  if (!parsed) {
    return null
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
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

function getTypeMeta(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.meeting
}

export default function EncadrantPlanningPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useEncadrantSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [planning, setPlanning] = useState<PlanningWeekOverview | null>(null)

  const loadPlanning = useCallback(
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
        const [planningResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<PlanningWeekOverview>("/planning/overview"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [planningResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (planningResult.status === "rejected") {
          throw planningResult.reason
        }

        const warnings: string[] = []
        if (sidebarResult.status === "rejected") {
          warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        setPlanning(planningResult.value)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement du planning impossible pour le moment."))
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
    void loadPlanning()
  }, [loadPlanning])

  const weekDays = useMemo(() => {
    const start = parseDate(planning?.week_start)
    const end = parseDate(planning?.week_end)
    if (!start || !end) {
      return [] as Array<{ key: string; dayLabel: string; dayNumber: string; fullDate: string }>
    }

    const rows: Array<{ key: string; dayLabel: string; dayNumber: string; fullDate: string }> = []
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = toDayKey(cursor.toISOString()) as string
      rows.push({
        key,
        dayLabel: WEEKDAY_FORMATTER.format(cursor).replace(/\.$/, ""),
        dayNumber: DAY_NUMBER_FORMATTER.format(cursor),
        fullDate: formatDate(cursor.toISOString()),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return rows
  }, [planning?.week_end, planning?.week_start])

  const agendaByDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()

    for (const event of planning?.events || []) {
      const key = toDayKey(event.start_at)
      if (!key) {
        continue
      }
      const items = map.get(key) || []
      items.push({
        id: `event-${event.id}`,
        title: event.title,
        type: event.event_type || "meeting",
        startAt: event.start_at,
        endAt: event.end_at,
        helper: event.attendee_name || event.location || "Evenement",
      })
      map.set(key, items)
    }

    for (const deadline of planning?.deadlines || []) {
      const key = toDayKey(deadline.deadline)
      if (!key) {
        continue
      }
      const items = map.get(key) || []
      items.push({
        id: `deadline-${deadline.task_id}`,
        title: deadline.title,
        type: "deadline",
        startAt: deadline.deadline,
        endAt: null,
        helper: deadline.stagiaire_nom_complet || `Stage #${deadline.stage_id}`,
      })
      map.set(key, items)
    }

    for (const [key, items] of map.entries()) {
      map.set(
        key,
        items.sort((a, b) => (parseDate(a.startAt)?.getTime() || 0) - (parseDate(b.startAt)?.getTime() || 0)),
      )
    }

    return map
  }, [planning?.deadlines, planning?.events])

  const upcomingItems = useMemo(() => {
    const allItems = Array.from(agendaByDay.values()).flat()
    return allItems
      .sort((a, b) => (parseDate(a.startAt)?.getTime() || 0) - (parseDate(b.startAt)?.getTime() || 0))
      .slice(0, 8)
  }, [agendaByDay])

  const weekLabel = useMemo(() => {
    if (!planning) {
      return "Semaine courante"
    }
    return `${formatDate(planning.week_start)} - ${formatDate(planning.week_end)}`
  }, [planning])

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Planification"
          subtitle={`Semaine du ${weekLabel}`}
          actions={(
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => void loadPlanning({ silent: true })}
                disabled={isLoading || isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Actualiser
              </Button>
              <Button size="sm" className="h-9 gap-1.5 text-xs" disabled title="Creation d evenement a connecter selon votre workflow">
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
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
              Chargement du planning...
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Semaine en cours</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {weekDays.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Planning indisponible.
                    </div>
                  ) : (
                    weekDays.map((day) => {
                      const items = agendaByDay.get(day.key) || []
                      return (
                        <div key={day.key} className="flex gap-4">
                          <div className="w-20 shrink-0 pt-2 text-center">
                            <p className="text-xs font-medium text-muted-foreground">{day.dayLabel}</p>
                            <p className="text-lg font-bold text-foreground">{day.dayNumber}</p>
                          </div>
                          <div className="flex-1 border-l border-border py-1 pl-4">
                            {items.length === 0 ? (
                              <p className="py-2 text-xs text-muted-foreground">Aucun evenement.</p>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {items.map((item) => {
                                  const typeMeta = getTypeMeta(item.type)
                                  return (
                                    <div key={item.id} className="rounded-lg border border-border p-3 transition-colors hover:bg-secondary/30">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            <span>{formatDateTime(item.startAt)}</span>
                                          </div>
                                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                            <MapPin className="h-3 w-3" />
                                            <span>{item.helper}</span>
                                          </div>
                                        </div>
                                        <Badge className={`border ${typeMeta.color}`}>{typeMeta.label}</Badge>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">A venir</CardTitle>
                  <CardDescription>Prochains evenements et deadlines</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {upcomingItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Aucune echeance a afficher.
                    </div>
                  ) : (
                    upcomingItems.map((item) => {
                      const typeMeta = getTypeMeta(item.type)
                      return (
                        <div key={item.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                            <Badge className={`border ${typeMeta.color}`}>{typeMeta.label}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(item.startAt)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.helper}</p>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Legende</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, meta]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.color.split(" ")[0]}`} />
                      <span className="text-xs text-muted-foreground">{meta.label}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Semaine active: {weekLabel}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
