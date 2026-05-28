import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  KanbanSquare,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  SendHorizontal,
  Target,
  UploadCloud,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useStagiaireSidebar } from "@/hooks/use-stagiaire-sidebar"
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

const KANBAN_COLUMNS: Array<{ status: TaskStatus; title: string; helper: string }> = [
  { status: "todo", title: "A faire", helper: "Backlog du stage" },
  { status: "in_progress", title: "En cours", helper: "Execution active" },
  { status: "done", title: "Soumises", helper: "En attente review" },
  { status: "validated", title: "Validees", helper: "Confirmees par encadreur" },
]

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

function normalizeTaskStatus(value: string): TaskStatus {
  const normalized = value.trim().toLowerCase()
  if (normalized === "todo" || normalized === "in_progress" || normalized === "done" || normalized === "validated") {
    return normalized
  }
  return "todo"
}

function normalizeTaskPriority(value: string): TaskPriority {
  const normalized = value.trim().toLowerCase()
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
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

function getDeadlineHint(task: NormalizedTask): { label: string; className: string } {
  const deadline = parseDate(task.deadline)
  if (!deadline) {
    return {
      label: "Sans deadline",
      className: "border-slate-200 bg-slate-50 text-slate-600",
    }
  }

  if (task.status === "done" || task.status === "validated") {
    return {
      label: `Deadline: ${formatDateTime(task.deadline)}`,
      className: "border-slate-200 bg-slate-50 text-slate-600",
    }
  }

  const diffDays = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) {
    return {
      label: `En retard (${Math.abs(diffDays)} j)`,
      className: "border-red-200 bg-red-50 text-red-700",
    }
  }
  if (diffDays <= 2) {
    return {
      label: `Urgent: ${formatDateTime(task.deadline)}`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }
  return {
    label: `Deadline: ${formatDateTime(task.deadline)}`,
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  }
}

export default function StagiaireTachesKanbanPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning } = useStagiaireSidebar()

  const [tasks, setTasks] = useState<TaskRead[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [taskActionError, setTaskActionError] = useState("")
  const [taskActionId, setTaskActionId] = useState<number | null>(null)

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [submitTask, setSubmitTask] = useState<NormalizedTask | null>(null)
  const [githubUrl, setGithubUrl] = useState("")
  const [fileUrl, setFileUrl] = useState("")
  const [submissionNotes, setSubmissionNotes] = useState("")
  const [submissionError, setSubmissionError] = useState("")
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)

  const normalizedTasks = useMemo<NormalizedTask[]>(
    () =>
      tasks.map((task) => ({
        ...task,
        status: normalizeTaskStatus(task.status),
        priority: normalizeTaskPriority(task.priority),
      })),
    [tasks],
  )

  const tasksByStatus = useMemo<Record<TaskStatus, NormalizedTask[]>>(() => {
    return {
      todo: normalizedTasks.filter((task) => task.status === "todo"),
      in_progress: normalizedTasks.filter((task) => task.status === "in_progress"),
      done: normalizedTasks.filter((task) => task.status === "done"),
      validated: normalizedTasks.filter((task) => task.status === "validated"),
    }
  }, [normalizedTasks])

  const stats = useMemo(() => {
    const total = normalizedTasks.length
    const inProgress = normalizedTasks.filter((task) => task.status === "in_progress").length
    const completed = normalizedTasks.filter((task) => task.status === "done" || task.status === "validated").length
    const overdue = normalizedTasks.filter((task) => isTaskOverdue(task)).length
    return { total, inProgress, completed, overdue }
  }, [normalizedTasks])

  const combinedWarning = dataWarning || sidebarWarning

  const resetSubmissionDialog = useCallback(() => {
    setSubmitDialogOpen(false)
    setSubmitTask(null)
    setGithubUrl("")
    setFileUrl("")
    setSubmissionNotes("")
    setSubmissionError("")
  }, [])

  const loadPage = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true
      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setPageError("")
      setDataWarning("")
      setTaskActionError("")

      const accessToken = localStorage.getItem("stages_access_token")
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
        const tasksResult = await requestAuthJson<TaskRead[]>("/tasks/my-tasks")

        setTasks(tasksResult)
        setDataWarning("")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement des taches impossible pour le moment."))
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
    void loadPage()
  }, [loadPage])

  const updateMyTaskStatus = useCallback(
    async (taskId: number, status: TaskStatus) => {
      setTaskActionError("")
      setTaskActionId(taskId)
      try {
        const updatedTask = await requestAuthJson<TaskRead>(`/tasks/${taskId}/my-status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        })
        setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setTaskActionError(asErrorMessage(error, "Mise a jour de la tache impossible."))
      } finally {
        setTaskActionId((prev) => (prev === taskId ? null : prev))
      }
    },
    [navigate],
  )

  const openSubmissionDialog = useCallback((task: NormalizedTask) => {
    setSubmitTask(task)
    setGithubUrl("")
    setFileUrl("")
    setSubmissionNotes("")
    setSubmissionError("")
    setSubmitDialogOpen(true)
  }, [])

  const handleSubmitTask = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!submitTask) {
        return
      }

      const trimmedGithubUrl = githubUrl.trim()
      const trimmedFileUrl = fileUrl.trim()
      if (!trimmedGithubUrl || !trimmedFileUrl) {
        setSubmissionError("Les liens GitHub et livrable sont obligatoires.")
        return
      }
      if (!/^https?:\/\//i.test(trimmedGithubUrl) || !trimmedGithubUrl.toLowerCase().includes("github.com")) {
        setSubmissionError("Le lien GitHub doit etre valide et pointer vers github.com.")
        return
      }
      if (!/^https?:\/\//i.test(trimmedFileUrl)) {
        setSubmissionError("Le lien de livrable doit commencer par http:// ou https://.")
        return
      }

      setSubmissionError("")
      setTaskActionError("")
      setIsSubmittingTask(true)

      try {
        const updatedTask = await requestAuthJson<TaskRead>(`/tasks/${submitTask.id}/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            github_url: trimmedGithubUrl,
            file_url: trimmedFileUrl,
            content: submissionNotes.trim() || null,
          }),
        })

        setTasks((prev) => prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
        resetSubmissionDialog()
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setSubmissionError(asErrorMessage(error, "Soumission impossible pour le moment."))
      } finally {
        setIsSubmittingTask(false)
      }
    },
    [fileUrl, githubUrl, navigate, resetSubmissionDialog, submissionNotes, submitTask],
  )

  return (
    <DashboardShell role="stagiaire" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Taches Kanban"
          subtitle="Gestion complete des taches du projet: lancement, pause, soumission et validation."
          actions={(
            <Button
              variant="outline"
              onClick={() => void loadPage({ silent: true })}
              disabled={isLoading || isRefreshing}
              className="gap-2"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Actualiser
                </>
              )}
            </Button>
          )}
        />

        {pageError && (
          <Card className="border-red-200 bg-red-50/70">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-700">{pageError}</p>
              <Button
                variant="outline"
                className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                onClick={() => void loadPage()}
              >
                Reessayer
              </Button>
            </CardContent>
          </Card>
        )}

        {combinedWarning && (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="flex items-center gap-2 py-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{combinedWarning}</span>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card className="border-indigo-100 bg-white/90">
            <CardContent className="flex min-h-[18rem] items-center justify-center gap-3 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              Chargement des taches...
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total taches</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats.total}</span>
                    <KanbanSquare className="h-5 w-5 text-indigo-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">En cours</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats.inProgress}</span>
                    <PlayCircle className="h-5 w-5 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completes</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats.completed}</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Retard</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats.overdue}</span>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-indigo-100 bg-white/95 shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KanbanSquare className="h-5 w-5 text-indigo-600" />
                  Board Kanban
                </CardTitle>
                <CardDescription>
                  Cliquez sur les actions pour faire avancer la tache dans le workflow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {taskActionError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {taskActionError}
                  </div>
                )}

                {normalizedTasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600">
                    Aucune tache assignee pour le moment.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-4">
                    {KANBAN_COLUMNS.map((column) => {
                      const columnTasks = tasksByStatus[column.status]
                      return (
                        <div
                          key={column.status}
                          className="rounded-xl border border-border bg-background"
                        >
                          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{column.title}</p>
                              <p className="text-[11px] text-muted-foreground">{column.helper}</p>
                            </div>
                            <Badge variant="secondary">{columnTasks.length}</Badge>
                          </div>

                          <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto p-3">
                            {columnTasks.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
                                Vide
                              </div>
                            ) : (
                              columnTasks.map((task) => {
                                const deadlineMeta = getDeadlineHint(task)
                                const isBusy = taskActionId === task.id || (isSubmittingTask && submitTask?.id === task.id)
                                return (
                                  <div
                                    key={task.id}
                                    className={cn(
                                      "rounded-lg border p-3 transition-colors",
                                      isTaskOverdue(task)
                                        ? "border-red-200 bg-red-50/40"
                                        : "border-border bg-card hover:bg-secondary/20",
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-semibold text-foreground">{task.title}</p>
                                      <Badge className={cn("text-[10px]", PRIORITY_META[task.priority].className)}>
                                        {PRIORITY_META[task.priority].label}
                                      </Badge>
                                    </div>

                                    {task.description && (
                                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                        {task.description}
                                      </p>
                                    )}

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                          deadlineMeta.className,
                                        )}
                                      >
                                        <CalendarDays className="h-3 w-3" />
                                        {deadlineMeta.label}
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                        <Target className="h-3 w-3" />
                                        Task #{task.id}
                                      </span>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {task.status === "todo" && (
                                        <Button
                                          size="sm"
                                          className="h-7 gap-1.5 text-xs"
                                          onClick={() => void updateMyTaskStatus(task.id, "in_progress")}
                                          disabled={isBusy}
                                        >
                                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                                          Commencer
                                        </Button>
                                      )}

                                      {task.status === "in_progress" && (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 gap-1.5 text-xs"
                                            onClick={() => void updateMyTaskStatus(task.id, "todo")}
                                            disabled={isBusy}
                                          >
                                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                                            Pause
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="h-7 gap-1.5 text-xs"
                                            onClick={() => openSubmissionDialog(task)}
                                            disabled={isBusy}
                                          >
                                            <SendHorizontal className="h-3.5 w-3.5" />
                                            Soumettre
                                          </Button>
                                        </>
                                      )}

                                      {task.status === "done" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 gap-1.5 text-xs"
                                          onClick={() => openSubmissionDialog(task)}
                                          disabled={isBusy}
                                        >
                                          <UploadCloud className="h-3.5 w-3.5" />
                                          Resoumettre
                                        </Button>
                                      )}

                                      {task.status === "validated" && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          Validee
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog
        open={submitDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetSubmissionDialog()
            return
          }
          setSubmitDialogOpen(true)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soumettre la tache</DialogTitle>
            <DialogDescription>
              {submitTask ? `Tache: ${submitTask.title}` : "Ajoutez les liens de livraison pour la review encadreur."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmitTask}>
            {submissionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {submissionError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="github_url">Lien GitHub</Label>
              <Input
                id="github_url"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="https://github.com/..."
                disabled={isSubmittingTask}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file_url">Lien livrable (Drive, PDF, archive, etc.)</Label>
              <Input
                id="file_url"
                value={fileUrl}
                onChange={(event) => setFileUrl(event.target.value)}
                placeholder="https://..."
                disabled={isSubmittingTask}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="submission_notes">Notes (optionnel)</Label>
              <Textarea
                id="submission_notes"
                value={submissionNotes}
                onChange={(event) => setSubmissionNotes(event.target.value)}
                rows={4}
                placeholder="Precisez ce qui a ete livre, les points restants, ou les limites connues."
                disabled={isSubmittingTask}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetSubmissionDialog} disabled={isSubmittingTask}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmittingTask}>
                {isSubmittingTask ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Soumission...
                  </>
                ) : (
                  <>
                    <SendHorizontal className="h-4 w-4" />
                    Envoyer pour review
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
