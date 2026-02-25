import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useStagiaireSidebar } from "@/hooks/use-stagiaire-sidebar"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { cn } from "@/lib/utils"

type TaskStatus = "todo" | "in_progress" | "done" | "validated"
type TaskPriority = "low" | "medium" | "high"

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

interface NormalizedTask extends Omit<TaskRead, "status" | "priority"> {
  status: TaskStatus
  priority: TaskPriority
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "A faire", className: "border-slate-200 bg-slate-50 text-slate-700" },
  in_progress: { label: "En cours", className: "border-blue-200 bg-blue-50 text-blue-700" },
  done: { label: "Soumise", className: "border-amber-200 bg-amber-50 text-amber-700" },
  validated: { label: "Validee", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
}

const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Basse", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  medium: { label: "Moyenne", className: "border-blue-200 bg-blue-50 text-blue-700" },
  high: { label: "Haute", className: "border-red-200 bg-red-50 text-red-700" },
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

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const source = value.includes("T") ? value : `${value}T00:00:00`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateTime(value: string | null | undefined): string {
  const parsed = parseDate(value)
  return parsed ? DATE_TIME_FORMATTER.format(parsed) : "-"
}

function normalizeTaskStatus(value: string | null | undefined): TaskStatus {
  const normalized = (value || "").trim().toLowerCase()
  if (normalized === "in_progress" || normalized === "done" || normalized === "validated") {
    return normalized
  }
  return "todo"
}

function normalizeTaskPriority(value: string | null | undefined): TaskPriority {
  const normalized = (value || "").trim().toLowerCase()
  if (normalized === "low" || normalized === "high") {
    return normalized
  }
  return "medium"
}

function isTaskOverdue(task: NormalizedTask): boolean {
  if (task.status === "done" || task.status === "validated") {
    return false
  }
  const deadline = parseDate(task.deadline)
  if (!deadline) {
    return false
  }
  return deadline.getTime() < Date.now()
}

function statusNarrative(task: NormalizedTask): string {
  if (task.status === "validated") {
    return "Tache validee par votre encadreur."
  }
  if (task.status === "done") {
    return "Tache soumise, en attente de validation."
  }
  if (task.status === "in_progress") {
    return "Travail en cours sur cette tache."
  }
  return "Tache planifiee, non commencee."
}

export default function StagiaireJournalPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning } = useStagiaireSidebar()

  const [tasks, setTasks] = useState<TaskRead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 6

  const loadJournal = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true
      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setPageError("")

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
        const nextTasks = await requestAuthJson<TaskRead[]>("/tasks/my-tasks")
        setTasks(nextTasks)
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement du journal impossible pour le moment."))
      } finally {
        if (silent) {
          setIsRefreshing(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [navigate],
  )

  useEffect(() => {
    void loadJournal()
  }, [loadJournal])

  const normalizedTasks = useMemo<NormalizedTask[]>(
    () =>
      tasks.map((task) => ({
        ...task,
        status: normalizeTaskStatus(task.status),
        priority: normalizeTaskPriority(task.priority),
      })),
    [tasks],
  )

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return normalizedTasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false
      }

      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false
      }

      const updatedAt = parseDate(task.updated_at)
      if (dateFrom) {
        const fromDate = parseDate(dateFrom)
        if (fromDate && (!updatedAt || updatedAt < fromDate)) {
          return false
        }
      }
      if (dateTo) {
        const toDate = parseDate(dateTo)
        if (toDate) {
          const endOfDay = new Date(toDate)
          endOfDay.setHours(23, 59, 59, 999)
          if (!updatedAt || updatedAt > endOfDay) {
            return false
          }
        }
      }

      if (!query) {
        return true
      }

      const haystack = [
        task.title,
        task.description || "",
        `task ${task.id}`,
        `projet ${task.project_id}`,
      ].join(" ").toLowerCase()
      return haystack.includes(query)
    })
  }, [dateFrom, dateTo, normalizedTasks, priorityFilter, searchQuery, statusFilter])

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const timeA = parseDate(a.updated_at)?.getTime() || 0
      const timeB = parseDate(b.updated_at)?.getTime() || 0
      return timeB - timeA
    })
  }, [filteredTasks])

  const stats = useMemo(() => {
    const total = normalizedTasks.length
    const inProgress = normalizedTasks.filter((task) => task.status === "in_progress").length
    const inReview = normalizedTasks.filter((task) => task.status === "done").length
    const validated = normalizedTasks.filter((task) => task.status === "validated").length
    const overdue = normalizedTasks.filter((task) => isTaskOverdue(task)).length
    return { total, inProgress, inReview, validated, overdue }
  }, [normalizedTasks])

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize))
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedTasks.slice(start, start + pageSize)
  }, [currentPage, sortedTasks])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    setCurrentPage(1)
  }, [dateFrom, dateTo, priorityFilter, searchQuery, statusFilter])

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setPriorityFilter("all")
    setDateFrom("")
    setDateTo("")
  }

  return (
    <DashboardShell role="stagiaire" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Mon Journal"
          subtitle="Suivi simple de votre activite a partir de vos taches reelles."
          actions={(
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadJournal({ silent: true })}
              disabled={isLoading || isRefreshing}
              className="text-xs"
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
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{sidebarWarning}</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Total taches</p>
              <p className="mt-1 text-xl font-bold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">En cours</p>
              <p className="mt-1 text-xl font-bold text-blue-700">{stats.inProgress}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">En review</p>
              <p className="mt-1 text-xl font-bold text-amber-700">{stats.inReview}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Validees</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">{stats.validated}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">En retard</p>
              <p className="mt-1 text-xl font-bold text-red-700">{stats.overdue}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Filtres du journal</CardTitle>
              <CardDescription>Filtrer par texte, statut, priorite et date de mise a jour.</CardDescription>
            </div>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="journal-search">Recherche</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="journal-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Titre, description, task, projet..."
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="todo">A faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Soumise</SelectItem>
                  <SelectItem value="validated">Validee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorite</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes priorites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-date-from">Maj depuis</Label>
              <Input
                id="journal-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-date-to">Maj jusqu a</Label>
              <Input
                id="journal-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="md:col-span-2 xl:col-span-6">
              <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
                Reinitialiser les filtres
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, index) => (
              <Card key={`journal-skeleton-${index}`} className="shadow-sm">
                <CardContent className="space-y-3 py-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedTasks.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Search className="h-5 w-5" />
              Aucune activite ne correspond aux filtres actuels.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedTasks.map((task) => {
              const statusMeta = STATUS_META[task.status]
              const priorityMeta = PRIORITY_META[task.priority]
              const overdue = isTaskOverdue(task)

              return (
                <Card
                  key={task.id}
                  className={cn(
                    "shadow-sm transition-colors",
                    overdue ? "border-amber-200 bg-amber-50/30" : "border-border bg-card",
                  )}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", statusMeta.className)}>
                            {statusMeta.label}
                          </span>
                          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", priorityMeta.className)}>
                            {priorityMeta.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            Task #{task.id}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Projet #{task.project_id}
                          </Badge>
                          {overdue && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                              <Clock3 className="h-3.5 w-3.5" />
                              Deadline depassee
                            </span>
                          )}
                        </div>

                        {task.description ? (
                          <p className="text-sm leading-relaxed text-muted-foreground">{task.description}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Aucune description ajoutee.</p>
                        )}

                        <div className="rounded-md bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
                          {statusNarrative(task)}
                        </div>
                      </div>

                      <div className="shrink-0 space-y-1 text-xs text-muted-foreground sm:text-right">
                        <p className="inline-flex items-center gap-1 sm:justify-end">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Maj: {formatDateTime(task.updated_at)}
                        </p>
                        <p>Creation: {formatDateTime(task.created_at)}</p>
                        <p>Deadline: {formatDateTime(task.deadline)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              Precedent
            </Button>
            <div className="text-xs text-muted-foreground">
              Page {currentPage} sur {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Suivant
            </Button>
          </div>
        )}

        {!isLoading && stats.validated > 0 && (
          <Card className="border-emerald-100 bg-emerald-50/20 shadow-sm">
            <CardContent className="flex items-center gap-2 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {stats.validated} tache(s) deja validee(s). Continuez avec les taches en cours.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  )
}
