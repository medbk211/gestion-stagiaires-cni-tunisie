import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Calendar,
  Clock,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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

interface StagiaireRead {
  id: number
  nom: string
  prenom: string
  email: string
}

interface AgendaItem {
  id: string
  title: string
  type: string
  startAt: string
  endAt: string | null
  helper: string
}

type PlanningEventType = "meeting" | "review" | "visit" | "deadline"
type PlanningPriority = "low" | "medium" | "high"

interface PlanningCreateFormState {
  title: string
  description: string
  event_type: PlanningEventType
  priority: PlanningPriority
  attendee_name: string
  location: string
  start_at: string
  end_at: string
  stagiaire_id: string
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

const PRIORITY_CONFIG: Record<PlanningPriority, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
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

function toDateTimeLocalValue(value: string | Date | null | undefined): string {
  const parsed = value instanceof Date ? value : parseDate(value)
  if (!parsed) {
    return ""
  }
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  const hours = String(parsed.getHours()).padStart(2, "0")
  const minutes = String(parsed.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
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

function fullName(prenom: string | null | undefined, nom: string | null | undefined): string {
  return `${prenom || ""} ${nom || ""}`.trim()
}

function roundToNextHour(source: Date): Date {
  const value = new Date(source)
  value.setMinutes(0, 0, 0)
  value.setHours(value.getHours() + 1)
  return value
}

function buildInitialCreateForm(referenceDate?: Date): PlanningCreateFormState {
  const start = roundToNextHour(referenceDate || new Date())
  const end = new Date(start)
  end.setHours(end.getHours() + 1)

  return {
    title: "",
    description: "",
    event_type: "meeting",
    priority: "medium",
    attendee_name: "",
    location: "",
    start_at: toDateTimeLocalValue(start),
    end_at: toDateTimeLocalValue(end),
    stagiaire_id: "",
  }
}

export default function EncadrantPlanningPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useEncadrantSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [planning, setPlanning] = useState<PlanningWeekOverview | null>(null)
  const [stagiaires, setStagiaires] = useState<StagiaireRead[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createForm, setCreateForm] = useState<PlanningCreateFormState>(buildInitialCreateForm())

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
        const [planningResult, stagiairesResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<PlanningWeekOverview>("/planning/overview"),
          requestAuthJson<StagiaireRead[]>("/encadreur/me/stagiaires"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [planningResult, stagiairesResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (planningResult.status === "rejected") {
          throw planningResult.reason
        }

        const warnings: string[] = []
        if (stagiairesResult.status === "fulfilled") {
          setStagiaires(stagiairesResult.value)
        } else {
          setStagiaires([])
          warnings.push(`Stagiaires: ${asErrorMessage(stagiairesResult.reason, "indisponibles")}`)
        }
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

  const stagiaireById = useMemo<Record<number, StagiaireRead>>(() => {
    const next: Record<number, StagiaireRead> = {}
    for (const stagiaire of stagiaires) {
      next[stagiaire.id] = stagiaire
    }
    return next
  }, [stagiaires])

  const resetCreateDialog = useCallback(() => {
    setCreateError("")
    setCreateForm(buildInitialCreateForm())
    setIsCreateDialogOpen(false)
  }, [])

  const openCreateDialog = useCallback(() => {
    setActionSuccess("")
    setCreateError("")
    setCreateForm((previous) => ({
      ...buildInitialCreateForm(),
      stagiaire_id: previous.stagiaire_id || "",
    }))
    setIsCreateDialogOpen(true)
  }, [])

  const selectedCreateStagiaire = useMemo(() => {
    if (!createForm.stagiaire_id) {
      return null
    }
    const id = Number(createForm.stagiaire_id)
    return Number.isFinite(id) ? stagiaireById[id] || null : null
  }, [createForm.stagiaire_id, stagiaireById])

  useEffect(() => {
    if (searchParams.get("create") !== "1" || isLoading) {
      return
    }

    openCreateDialog()

    const next = new URLSearchParams(searchParams)
    next.delete("create")
    setSearchParams(next, { replace: true })
  }, [isLoading, openCreateDialog, searchParams, setSearchParams])

  const handleCreateEvent = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const title = createForm.title.trim()
      const startAt = createForm.start_at ? new Date(createForm.start_at) : null
      const endAt = createForm.end_at ? new Date(createForm.end_at) : null
      const location = createForm.location.trim()
      const description = createForm.description.trim()
      const attendeeName = createForm.attendee_name.trim() || fullName(selectedCreateStagiaire?.prenom, selectedCreateStagiaire?.nom)
      const stagiaireId = createForm.stagiaire_id ? Number(createForm.stagiaire_id) : null

      if (!title) {
        setCreateError("Le titre est obligatoire.")
        return
      }

      if (!startAt || Number.isNaN(startAt.getTime())) {
        setCreateError("La date de debut est obligatoire.")
        return
      }

      if (endAt && Number.isNaN(endAt.getTime())) {
        setCreateError("La date de fin est invalide.")
        return
      }

      if (endAt && endAt.getTime() <= startAt.getTime()) {
        setCreateError("La date de fin doit etre apres la date de debut.")
        return
      }

      setCreateError("")
      setActionSuccess("")
      setIsCreatingEvent(true)

      try {
        const created = await requestAuthJson<PlanningEventRead>("/planning/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description: description || null,
            event_type: createForm.event_type,
            priority: createForm.priority,
            attendee_name: attendeeName || null,
            location: location || null,
            start_at: startAt.toISOString(),
            end_at: endAt ? endAt.toISOString() : null,
            stagiaire_id: stagiaireId,
          }),
        })

        const eventStart = parseDate(created.start_at)
        const weekStart = parseDate(planning?.week_start)
        const weekEnd = parseDate(planning?.week_end)
        const isVisibleThisWeek =
          Boolean(eventStart && weekStart && weekEnd) &&
          eventStart!.getTime() >= weekStart!.getTime() &&
          eventStart!.getTime() <= weekEnd!.getTime() + (24 * 60 * 60 * 1000 - 1)

        resetCreateDialog()
        await loadPlanning({ silent: true })
        setActionSuccess(
          isVisibleThisWeek
            ? "Planification ajoutee avec succes."
            : "Planification ajoutee avec succes. Elle n apparaitra pas dans la semaine actuellement affichee.",
        )
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setCreateError(asErrorMessage(error, "Creation de la planification impossible pour le moment."))
      } finally {
        setIsCreatingEvent(false)
      }
    },
    [createForm, loadPlanning, navigate, planning?.week_end, planning?.week_start, resetCreateDialog, selectedCreateStagiaire?.nom, selectedCreateStagiaire?.prenom],
  )

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
              <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={openCreateDialog}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter planification
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

        {actionSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {actionSuccess}
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

        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetCreateDialog()
              return
            }
            setIsCreateDialogOpen(true)
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ajouter une planification</DialogTitle>
              <DialogDescription>
                Programmez une reunion, une review ou une visite avec vos stagiaires depuis cette vue.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleCreateEvent}>
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {createError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="planning_title">Titre</Label>
                <Input
                  id="planning_title"
                  value={createForm.title}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Ex: Review hebdomadaire du sprint"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="planning_type">Type</Label>
                  <Select
                    value={createForm.event_type}
                    onValueChange={(value) => setCreateForm((previous) => ({ ...previous, event_type: value as PlanningEventType }))}
                  >
                    <SelectTrigger id="planning_type" className="w-full">
                      <SelectValue placeholder="Selectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_CONFIG).map(([key, meta]) => (
                        <SelectItem key={key} value={key}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="planning_priority">Priorite</Label>
                  <Select
                    value={createForm.priority}
                    onValueChange={(value) => setCreateForm((previous) => ({ ...previous, priority: value as PlanningPriority }))}
                  >
                    <SelectTrigger id="planning_priority" className="w-full">
                      <SelectValue placeholder="Selectionner une priorite" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_CONFIG).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="planning_stagiaire">Stagiaire lie</Label>
                  <Select
                    value={createForm.stagiaire_id || "__none__"}
                    onValueChange={(value) => setCreateForm((previous) => ({
                      ...previous,
                      stagiaire_id: value === "__none__" ? "" : value,
                    }))}
                  >
                    <SelectTrigger id="planning_stagiaire" className="w-full">
                      <SelectValue placeholder="Selectionner un stagiaire" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun stagiaire</SelectItem>
                      {stagiaires.map((stagiaire) => (
                        <SelectItem key={stagiaire.id} value={String(stagiaire.id)}>
                          {fullName(stagiaire.prenom, stagiaire.nom)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCreateStagiaire ? (
                    <p className="text-[11px] text-muted-foreground">
                      {selectedCreateStagiaire.email}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="planning_attendee">Participant / contact</Label>
                  <Input
                    id="planning_attendee"
                    value={createForm.attendee_name}
                    onChange={(event) => setCreateForm((previous) => ({ ...previous, attendee_name: event.target.value }))}
                    placeholder={selectedCreateStagiaire ? fullName(selectedCreateStagiaire.prenom, selectedCreateStagiaire.nom) : "Nom du participant"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planning_location">Lieu ou canal</Label>
                <Input
                  id="planning_location"
                  value={createForm.location}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, location: event.target.value }))}
                  placeholder="Salle A, Teams, Meet..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="planning_start">Debut</Label>
                  <Input
                    id="planning_start"
                    type="datetime-local"
                    value={createForm.start_at}
                    onChange={(event) => setCreateForm((previous) => ({ ...previous, start_at: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="planning_end">Fin</Label>
                  <Input
                    id="planning_end"
                    type="datetime-local"
                    value={createForm.end_at}
                    onChange={(event) => setCreateForm((previous) => ({ ...previous, end_at: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planning_description">Description</Label>
                <Textarea
                  id="planning_description"
                  value={createForm.description}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, description: event.target.value }))}
                  rows={4}
                  placeholder="Objectif de la reunion, points a revoir, livrables attendus..."
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetCreateDialog} disabled={isCreatingEvent}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isCreatingEvent}>
                  {isCreatingEvent ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creation...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Ajouter planification
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  )
}
