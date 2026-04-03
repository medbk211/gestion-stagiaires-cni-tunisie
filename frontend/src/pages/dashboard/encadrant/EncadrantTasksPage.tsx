import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SendHorizontal,
  SquarePen,
  Target,
  Trash2,
  UserRound,
} from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"
import { useEncadrantSidebar } from "@/hooks/use-encadrant-sidebar"

type TaskStatus = "todo" | "in_progress" | "done" | "validated"
type TaskPriority = "low" | "medium" | "high"
type TaskStatusFilter = "ALL" | TaskStatus

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

interface TaskSubmissionRead {
  id: number
  task_id: number
  stagiaire_id: number
  github_url: string
  file_url: string
  notes: string | null
  decision: string | null
  review_feedback: string | null
  submitted_at: string
  reviewed_at: string | null
}

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

interface StagiaireRead {
  id: number
  nom: string
  prenom: string
  email: string
  etablissement: string
  type_stage: string
  statut_stage: string
}

interface EncadreurOverviewRead {
  totaux: {
    tasks: number
    tasks_validated: number
    tasks_in_review: number
  }
}

interface TaskFormState {
  stagiaire_id: string
  title: string
  description: string
  priority: TaskPriority
  deadline: string
}

interface EditTaskFormState {
  title: string
  description: string
  priority: TaskPriority
  deadline: string
}

interface NormalizedTask extends Omit<TaskRead, "priority" | "status"> {
  priority: TaskPriority
  status: TaskStatus
}

interface TaskListItem extends NormalizedTask {
  stage: StageRead | null
  stagiaire: StagiaireRead | null
  stagiaireName: string
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

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
  done: { label: "En review", className: "border-amber-200 bg-amber-50 text-amber-700" },
  validated: { label: "Validee", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
}

const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Basse", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  medium: { label: "Moyenne", className: "border-blue-200 bg-blue-50 text-blue-700" },
  high: { label: "Haute", className: "border-red-200 bg-red-50 text-red-700" },
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

function toDateTimeLocalValue(value: string | null | undefined): string {
  const parsed = parseDate(value)
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

function fullName(prenom: string | null | undefined, nom: string | null | undefined): string {
  return `${prenom || ""} ${nom || ""}`.trim()
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

function pickPreferredStage(current: StageRead | undefined, candidate: StageRead): StageRead {
  if (!current) {
    return candidate
  }
  if (candidate.statut_stage === "EN_COURS" && current.statut_stage !== "EN_COURS") {
    return candidate
  }
  if (candidate.id > current.id) {
    return candidate
  }
  return current
}

function pickPreferredTaskStage(current: StageRead | undefined, candidate: StageRead): StageRead {
  if (!current) {
    return candidate
  }

  const currentHasProject = Boolean(current.projet_id)
  const candidateHasProject = Boolean(candidate.projet_id)
  if (candidateHasProject !== currentHasProject) {
    return candidateHasProject ? candidate : current
  }

  const currentIsActive = current.statut_stage === "EN_COURS"
  const candidateIsActive = candidate.statut_stage === "EN_COURS"
  if (candidateIsActive !== currentIsActive) {
    return candidateIsActive ? candidate : current
  }

  if (candidate.id > current.id) {
    return candidate
  }
  return current
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

function getDeadlineMeta(task: NormalizedTask): { label: string; className: string } {
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

function getTaskSortWeight(task: TaskListItem): number {
  if (task.status === "done") {
    return 0
  }
  if (isTaskOverdue(task)) {
    return 1
  }
  if (task.status === "in_progress") {
    return 2
  }
  if (task.status === "todo") {
    return 3
  }
  return 4
}

function SubmissionDecisionBadge({ decision }: { decision: string | null | undefined }) {
  if (!decision) {
    return null
  }

  const approved = decision === "approved"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        approved
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      {approved ? "Approuvee" : "Corrections demandees"}
    </span>
  )
}

export default function EncadrantTasksPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useEncadrantSidebar()

  const [tasks, setTasks] = useState<TaskRead[]>([])
  const [stagiaires, setStagiaires] = useState<StagiaireRead[]>([])
  const [stages, setStages] = useState<StageRead[]>([])
  const [overview, setOverview] = useState<EncadreurOverviewRead | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [actionError, setActionError] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("ALL")

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<TaskFormState>({
    stagiaire_id: "",
    title: "",
    description: "",
    priority: "medium",
    deadline: "",
  })
  const [createError, setCreateError] = useState("")

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskListItem | null>(null)
  const [editForm, setEditForm] = useState<EditTaskFormState>({
    title: "",
    description: "",
    priority: "medium",
    deadline: "",
  })
  const [editError, setEditError] = useState("")

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewTask, setReviewTask] = useState<TaskListItem | null>(null)
  const [reviewSubmission, setReviewSubmission] = useState<TaskSubmissionRead | null>(null)
  const [reviewFeedback, setReviewFeedback] = useState("")
  const [reviewError, setReviewError] = useState("")
  const [isReviewLoading, setIsReviewLoading] = useState(false)
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false)

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
      setActionError("")

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
        const [tasksResult, stagiairesResult, stagesResult, overviewResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<TaskRead[]>("/tasks/my-tasks"),
          requestAuthJson<StagiaireRead[]>("/encadreur/me/stagiaires"),
          requestAuthJson<StageRead[]>("/Stages/my-interns"),
          requestAuthJson<EncadreurOverviewRead>("/statistiques/encadreur/overview"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [tasksResult, stagiairesResult, stagesResult, overviewResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (tasksResult.status === "rejected") {
          throw tasksResult.reason
        }

        const warnings: string[] = []

        setTasks(tasksResult.value || [])
        if (stagiairesResult.status === "fulfilled") {
          setStagiaires(stagiairesResult.value)
        } else {
          setStagiaires([])
          warnings.push(`Stagiaires: ${asErrorMessage(stagiairesResult.reason, "indisponibles")}`)
        }

        if (stagesResult.status === "fulfilled") {
          setStages(stagesResult.value)
        } else {
          setStages([])
          warnings.push(`Stages: ${asErrorMessage(stagesResult.reason, "indisponibles")}`)
        }

        if (overviewResult.status === "fulfilled") {
          setOverview(overviewResult.value)
        } else {
          setOverview(null)
          warnings.push(`Statistiques: ${asErrorMessage(overviewResult.reason, "indisponibles")}`)
        }

        if (sidebarResult.status === "rejected") {
          warnings.push(`Navigation: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        setDataWarning(warnings[0] || "")
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
    [navigate, refreshSidebar],
  )

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const stageByStagiaire = useMemo<Record<number, StageRead>>(() => {
    const map: Record<number, StageRead> = {}
    for (const stage of stages) {
      map[stage.stagiaire_id] = pickPreferredStage(map[stage.stagiaire_id], stage)
    }
    return map
  }, [stages])

  const taskStageByStagiaire = useMemo<Record<number, StageRead>>(() => {
    const map: Record<number, StageRead> = {}
    for (const stage of stages) {
      map[stage.stagiaire_id] = pickPreferredTaskStage(map[stage.stagiaire_id], stage)
    }
    return map
  }, [stages])

  const stageById = useMemo<Record<number, StageRead>>(() => {
    const map: Record<number, StageRead> = {}
    for (const stage of stages) {
      map[stage.id] = stage
    }
    return map
  }, [stages])

  const stagiaireById = useMemo<Record<number, StagiaireRead>>(() => {
    const map: Record<number, StagiaireRead> = {}
    for (const stagiaire of stagiaires) {
      map[stagiaire.id] = stagiaire
    }
    return map
  }, [stagiaires])

  const availableCreateTargets = useMemo(() => {
    return stagiaires
      .map((stagiaire) => ({
        stagiaire,
        stage: taskStageByStagiaire[stagiaire.id] || null,
      }))
      .filter((item) => item.stage && item.stage.projet_id)
      .sort((a, b) => fullName(a.stagiaire.prenom, a.stagiaire.nom).localeCompare(fullName(b.stagiaire.prenom, b.stagiaire.nom)))
  }, [stagiaires, taskStageByStagiaire])

  const normalizedTasks = useMemo<NormalizedTask[]>(
    () =>
      tasks.map((task) => ({
        ...task,
        status: normalizeTaskStatus(task.status),
        priority: normalizeTaskPriority(task.priority),
      })),
    [tasks],
  )

  const taskItems = useMemo<TaskListItem[]>(() => {
    return normalizedTasks
      .map((task) => {
        const stage = stageById[task.stage_id] || null
        const stagiaire = stage ? stagiaireById[stage.stagiaire_id] || null : null
        const stagiaireName = stagiaire
          ? fullName(stagiaire.prenom, stagiaire.nom)
          : stage
            ? `Stagiaire #${stage.stagiaire_id}`
            : "Stagiaire non resolu"

        return {
          ...task,
          stage,
          stagiaire,
          stagiaireName,
        }
      })
      .sort((a, b) => {
        const weightA = getTaskSortWeight(a)
        const weightB = getTaskSortWeight(b)
        if (weightA !== weightB) {
          return weightA - weightB
        }

        const deadlineA = parseDate(a.deadline)?.getTime() || Number.MAX_SAFE_INTEGER
        const deadlineB = parseDate(b.deadline)?.getTime() || Number.MAX_SAFE_INTEGER
        if (deadlineA !== deadlineB) {
          return deadlineA - deadlineB
        }

        const updatedA = parseDate(a.updated_at)?.getTime() || 0
        const updatedB = parseDate(b.updated_at)?.getTime() || 0
        return updatedB - updatedA
      })
  }, [normalizedTasks, stageById, stagiaireById])

  const selectedStagiaireFilter = useMemo(() => {
    const value = searchParams.get("stagiaire")
    if (!value) {
      return "ALL"
    }
    return /^\d+$/.test(value) ? value : "ALL"
  }, [searchParams])

  const filteredTaskItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return taskItems.filter((task) => {
      const matchesStagiaire =
        selectedStagiaireFilter === "ALL" ||
        String(task.stagiaire?.id || task.stage?.stagiaire_id || "") === selectedStagiaireFilter
      const matchesStatus = statusFilter === "ALL" || task.status === statusFilter

      if (!matchesStagiaire || !matchesStatus) {
        return false
      }

      if (!query) {
        return true
      }

      const searchable = [
        String(task.id),
        task.title,
        task.description || "",
        task.stagiaireName,
        task.stagiaire?.email || "",
        task.stage?.texte_objectif || "",
      ]
        .join(" ")
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [searchQuery, selectedStagiaireFilter, statusFilter, taskItems])

  const stats = useMemo(() => {
    const total = overview?.totaux.tasks ?? normalizedTasks.length
    const inReview = overview?.totaux.tasks_in_review ?? normalizedTasks.filter((task) => task.status === "done").length
    const validated = overview?.totaux.tasks_validated ?? normalizedTasks.filter((task) => task.status === "validated").length
    const overdue = normalizedTasks.filter((task) => isTaskOverdue(task)).length
    return { total, inReview, validated, overdue }
  }, [normalizedTasks, overview?.totaux.tasks, overview?.totaux.tasks_in_review, overview?.totaux.tasks_validated])

  const combinedWarning = dataWarning || sidebarWarning

  const setStagiaireFilter = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams)
      if (value === "ALL") {
        next.delete("stagiaire")
      } else {
        next.set("stagiaire", value)
      }
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const resetCreateDialog = useCallback(() => {
    setCreateDialogOpen(false)
    setCreateError("")
    setCreateForm({
      stagiaire_id: "",
      title: "",
      description: "",
      priority: "medium",
      deadline: "",
    })
  }, [])

  const openCreateDialog = useCallback(() => {
    const preferredTarget =
      selectedStagiaireFilter !== "ALL"
        ? availableCreateTargets.find((item) => String(item.stagiaire.id) === selectedStagiaireFilter)
        : null

    setCreateForm({
      stagiaire_id: preferredTarget
        ? String(preferredTarget.stagiaire.id)
        : availableCreateTargets[0]
          ? String(availableCreateTargets[0].stagiaire.id)
          : "",
      title: "",
      description: "",
      priority: "medium",
      deadline: "",
    })
    setCreateError("")
    setCreateDialogOpen(true)
  }, [availableCreateTargets, selectedStagiaireFilter])

  const selectedCreateTarget = useMemo(
    () => availableCreateTargets.find((item) => String(item.stagiaire.id) === createForm.stagiaire_id) || null,
    [availableCreateTargets, createForm.stagiaire_id],
  )

  const handleCreateTask = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!selectedCreateTarget?.stage) {
        setCreateError("Selectionnez un stagiaire ayant un stage actif et un projet associe.")
        return
      }

      const title = createForm.title.trim()
      const deadline = createForm.deadline ? new Date(createForm.deadline) : null
      if (!title) {
        setCreateError("Le titre de la tache est obligatoire.")
        return
      }

      if (deadline && Number.isNaN(deadline.getTime())) {
        setCreateError("La deadline saisie est invalide.")
        return
      }

      if (!selectedCreateTarget.stage.projet_id) {
        setCreateError("Ce stage n a pas encore de projet associe.")
        return
      }

      setCreateError("")
      setActionError("")
      setActionSuccess("")
      setActionLoadingKey("create-task")

      try {
        const createdTask = await requestAuthJson<TaskRead>("/tasks/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description: createForm.description.trim() || null,
            priority: createForm.priority,
            deadline: deadline ? deadline.toISOString() : null,
            stage_id: selectedCreateTarget.stage.id,
            encadreur_id: selectedCreateTarget.stage.encadreur_id,
            projet_id: selectedCreateTarget.stage.projet_id,
          }),
        })

        setTasks((previous) => [createdTask, ...previous])
        setActionSuccess(`Tache creee pour ${fullName(selectedCreateTarget.stagiaire.prenom, selectedCreateTarget.stagiaire.nom)}.`)
        resetCreateDialog()
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setCreateError(asErrorMessage(error, "Creation de la tache impossible pour le moment."))
      } finally {
        setActionLoadingKey((previous) => (previous === "create-task" ? null : previous))
      }
    },
    [createForm.deadline, createForm.description, createForm.priority, createForm.title, navigate, resetCreateDialog, selectedCreateTarget],
  )

  const openEditDialog = useCallback((task: TaskListItem) => {
    setEditingTask(task)
    setEditForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      deadline: toDateTimeLocalValue(task.deadline),
    })
    setEditError("")
    setEditDialogOpen(true)
  }, [])

  const resetEditDialog = useCallback(() => {
    setEditDialogOpen(false)
    setEditingTask(null)
    setEditError("")
    setEditForm({
      title: "",
      description: "",
      priority: "medium",
      deadline: "",
    })
  }, [])

  const handleEditTask = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!editingTask) {
        return
      }

      const title = editForm.title.trim()
      if (!title) {
        setEditError("Le titre de la tache est obligatoire.")
        return
      }

      setEditError("")
      setActionError("")
      setActionSuccess("")
      setActionLoadingKey(`edit-${editingTask.id}`)

      try {
        const updatedTask = await requestAuthJson<TaskRead>(`/tasks/${editingTask.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description: editForm.description.trim() || null,
            priority: editForm.priority,
            deadline: editForm.deadline || null,
          }),
        })

        setTasks((previous) => previous.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
        setActionSuccess(`Tache "${updatedTask.title}" mise a jour.`)
        resetEditDialog()
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setEditError(asErrorMessage(error, "Mise a jour impossible pour le moment."))
      } finally {
        setActionLoadingKey((previous) => (previous === `edit-${editingTask.id}` ? null : previous))
      }
    },
    [editForm.deadline, editForm.description, editForm.priority, editForm.title, editingTask, navigate, resetEditDialog],
  )

  const handleDeleteTask = useCallback(
    async (task: TaskListItem) => {
      const confirmed = window.confirm(`Supprimer la tache "${task.title}" ?`)
      if (!confirmed) {
        return
      }

      setActionError("")
      setActionSuccess("")
      setActionLoadingKey(`delete-${task.id}`)

      try {
        await requestAuthJson<{ message: string }>(`/tasks/${task.id}`, {
          method: "DELETE",
        })
        setTasks((previous) => previous.filter((item) => item.id !== task.id))
        setActionSuccess(`Tache "${task.title}" supprimee.`)
        void refreshSidebar({ silent: true })
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setActionError(asErrorMessage(error, "Suppression impossible pour le moment."))
      } finally {
        setActionLoadingKey((previous) => (previous === `delete-${task.id}` ? null : previous))
      }
    },
    [navigate, refreshSidebar],
  )

  const resetReviewDialog = useCallback(() => {
    setReviewDialogOpen(false)
    setReviewTask(null)
    setReviewSubmission(null)
    setReviewFeedback("")
    setReviewError("")
    setIsReviewLoading(false)
    setIsReviewSubmitting(false)
  }, [])

  const openReviewDialog = useCallback(
    async (task: TaskListItem) => {
      setReviewDialogOpen(true)
      setReviewTask(task)
      setReviewSubmission(null)
      setReviewFeedback("")
      setReviewError("")
      setIsReviewLoading(true)

      try {
        const submission = await requestAuthJson<TaskSubmissionRead>(`/tasks/${task.id}/latest-submission`)
        setReviewSubmission(submission)
        setReviewFeedback(submission.review_feedback || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setReviewError(asErrorMessage(error, "Chargement de la soumission impossible pour le moment."))
      } finally {
        setIsReviewLoading(false)
      }
    },
    [navigate],
  )

  const submitReview = useCallback(
    async (decision: "approved" | "changes_requested") => {
      if (!reviewTask) {
        return
      }

      const feedback = reviewFeedback.trim()
      if (decision === "changes_requested" && !feedback) {
        setReviewError("Ajoutez un feedback avant de demander des corrections.")
        return
      }

      setReviewError("")
      setIsReviewSubmitting(true)

      try {
        const updatedTask = await requestAuthJson<TaskRead>(`/tasks/${reviewTask.id}/review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            feedback: feedback || null,
          }),
        })

        setTasks((previous) => previous.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
        setActionSuccess(
          decision === "approved"
            ? `Tache "${reviewTask.title}" approuvee.`
            : `Corrections demandees pour "${reviewTask.title}".`,
        )
        resetReviewDialog()
        void refreshSidebar({ silent: true })
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setReviewError(asErrorMessage(error, "Review impossible pour le moment."))
      } finally {
        setIsReviewSubmitting(false)
      }
    },
    [navigate, refreshSidebar, resetReviewDialog, reviewFeedback, reviewTask],
  )

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Taches"
          subtitle="Assignez, suivez et validez les taches de vos stagiaires depuis un seul espace."
          actions={(
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => void loadPage({ silent: true })}
                disabled={isLoading || isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Actualiser
              </Button>
              <Button
                size="sm"
                className="text-xs"
                onClick={openCreateDialog}
                disabled={isLoading}
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvelle tache
              </Button>
            </>
          )}
        />

        {pageError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {pageError}
          </div>
        )}

        {combinedWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {combinedWarning}
          </div>
        )}

        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {actionSuccess}
          </div>
        )}

        {isLoading ? (
          <Card className="border-indigo-100 bg-white/90">
            <CardContent className="flex min-h-[18rem] items-center justify-center gap-3 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              Chargement des taches encadrant...
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
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">En review</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats.inReview}</span>
                    <SendHorizontal className="h-5 w-5 text-amber-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Validees</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats.validated}</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">En retard</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats.overdue}</span>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-indigo-100 bg-white/95 shadow-sm">
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr_0.8fr]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Rechercher une tache, un stagiaire ou un objectif..."
                      className="pl-9"
                    />
                  </div>

                  <Select value={selectedStagiaireFilter} onValueChange={setStagiaireFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tous les stagiaires" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tous les stagiaires</SelectItem>
                      {stagiaires
                        .slice()
                        .sort((a, b) => fullName(a.prenom, a.nom).localeCompare(fullName(b.prenom, b.nom)))
                        .map((stagiaire) => (
                          <SelectItem key={stagiaire.id} value={String(stagiaire.id)}>
                            {fullName(stagiaire.prenom, stagiaire.nom)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatusFilter)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tous les statuts</SelectItem>
                      <SelectItem value="todo">A faire</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="done">En review</SelectItem>
                      <SelectItem value="validated">Validees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{filteredTaskItems.length} tache(s) affichee(s)</span>
                  <span>{availableCreateTargets.length} stagiaire(s) pret(s) pour recevoir des taches</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-indigo-100 bg-white/95 shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">Pilotage des taches</CardTitle>
                <CardDescription>
                  Les taches en review remontent en premier pour garder un workflow encadrant clair.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredTaskItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600">
                    {taskItems.length === 0
                      ? "Aucune tache assignee pour le moment. Creez la premiere tache depuis ce tableau."
                      : "Aucune tache ne correspond aux filtres actuels."}
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {filteredTaskItems.map((task) => {
                      const deadlineMeta = getDeadlineMeta(task)
                      const isDeleting = actionLoadingKey === `delete-${task.id}`
                      const isEditing = actionLoadingKey === `edit-${task.id}`
                      const isBusy = isDeleting || isEditing

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "rounded-xl border p-4 transition-colors",
                            isTaskOverdue(task)
                              ? "border-red-200 bg-red-50/30"
                              : task.status === "done"
                                ? "border-amber-200 bg-amber-50/30"
                                : "border-border bg-card hover:bg-secondary/20",
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">{task.title}</p>
                                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", STATUS_META[task.status].className)}>
                                  {STATUS_META[task.status].label}
                                </span>
                                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", PRIORITY_META[task.priority].className)}>
                                  {PRIORITY_META[task.priority].label}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  Task #{task.id}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <UserRound className="h-3 w-3" />
                                  {task.stagiaire ? (
                                    <Link
                                      to={`/dashboard/encadrant/stagiaires/${task.stagiaire.id}`}
                                      className="font-medium text-indigo-700 hover:text-indigo-800"
                                    >
                                      {task.stagiaireName}
                                    </Link>
                                  ) : (
                                    task.stagiaireName
                                  )}
                                </span>
                              </div>
                            </div>

                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                deadlineMeta.className,
                              )}
                            >
                              <CalendarDays className="h-3 w-3" />
                              {deadlineMeta.label}
                            </span>
                          </div>

                          {task.description && (
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                              {task.description}
                            </p>
                          )}

                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Contexte du stage
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                              {task.stage?.texte_objectif || `Projet #${task.project_id}`}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                              <span>Debut: {formatDate(task.stage?.date_debut)}</span>
                              <span>Fin: {formatDate(task.stage?.date_fin)}</span>
                              <span>Maj: {formatDateTime(task.updated_at)}</span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {task.status === "done" && (
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={() => void openReviewDialog(task)}
                                disabled={isBusy}
                              >
                                <SendHorizontal className="h-3.5 w-3.5" />
                                Ouvrir review
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => openEditDialog(task)}
                              disabled={isBusy}
                            >
                              {isEditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SquarePen className="h-3.5 w-3.5" />}
                              Modifier
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 border-red-200 text-xs text-red-700 hover:bg-red-50"
                              onClick={() => void handleDeleteTask(task)}
                              disabled={isBusy}
                            >
                              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              Supprimer
                            </Button>
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
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetCreateDialog()
            return
          }
          setCreateDialogOpen(true)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle tache</DialogTitle>
            <DialogDescription>
              Assignez une tache a un stagiaire avec une priorite claire et une deadline exploitable.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateTask}>
            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {createError}
              </div>
            )}

            {availableCreateTargets.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Aucun stagiaire n a actuellement un stage relie a un projet. Affectez d abord un projet au stage puis revenez creer la tache.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="task_stagiaire">Stagiaire</Label>
              <Select
                value={createForm.stagiaire_id}
                onValueChange={(value) => setCreateForm((previous) => ({ ...previous, stagiaire_id: value }))}
              >
                <SelectTrigger id="task_stagiaire" className="w-full">
                  <SelectValue placeholder="Selectionner un stagiaire" />
                </SelectTrigger>
                <SelectContent>
                  {availableCreateTargets.map((item) => (
                    <SelectItem key={item.stagiaire.id} value={String(item.stagiaire.id)}>
                      {fullName(item.stagiaire.prenom, item.stagiaire.nom)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCreateTarget?.stage && (
                <p className="text-[11px] text-muted-foreground">
                  Stage #{selectedCreateTarget.stage.id} - fin prevue le {formatDate(selectedCreateTarget.stage.date_fin)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task_title">Titre</Label>
              <Input
                id="task_title"
                value={createForm.title}
                onChange={(event) => setCreateForm((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="Ex: Finaliser la maquette du module RH"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task_description">Description</Label>
              <Textarea
                id="task_description"
                value={createForm.description}
                onChange={(event) => setCreateForm((previous) => ({ ...previous, description: event.target.value }))}
                rows={4}
                placeholder="Contexte, livrable attendu, criteres de validation, points d attention..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task_priority">Priorite</Label>
                <Select
                  value={createForm.priority}
                  onValueChange={(value) => setCreateForm((previous) => ({ ...previous, priority: value as TaskPriority }))}
                >
                  <SelectTrigger id="task_priority" className="w-full">
                    <SelectValue placeholder="Selectionner une priorite" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task_deadline">Deadline</Label>
                <Input
                  id="task_deadline"
                  type="datetime-local"
                  value={createForm.deadline}
                  onChange={(event) => setCreateForm((previous) => ({ ...previous, deadline: event.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCreateDialog} disabled={actionLoadingKey === "create-task"}>
                Annuler
              </Button>
              <Button type="submit" disabled={actionLoadingKey === "create-task" || !selectedCreateTarget?.stage}>
                {actionLoadingKey === "create-task" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creation...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Assigner la tache
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetEditDialog()
            return
          }
          setEditDialogOpen(true)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la tache</DialogTitle>
            <DialogDescription>
              {editingTask ? `Mise a jour de "${editingTask.title}" pour ${editingTask.stagiaireName}.` : "Ajustez les details de la tache."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleEditTask}>
            {editError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {editError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit_task_title">Titre</Label>
              <Input
                id="edit_task_title"
                value={editForm.title}
                onChange={(event) => setEditForm((previous) => ({ ...previous, title: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_task_description">Description</Label>
              <Textarea
                id="edit_task_description"
                value={editForm.description}
                onChange={(event) => setEditForm((previous) => ({ ...previous, description: event.target.value }))}
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit_task_priority">Priorite</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(value) => setEditForm((previous) => ({ ...previous, priority: value as TaskPriority }))}
                >
                  <SelectTrigger id="edit_task_priority" className="w-full">
                    <SelectValue placeholder="Selectionner une priorite" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_task_deadline">Deadline</Label>
                <Input
                  id="edit_task_deadline"
                  type="datetime-local"
                  value={editForm.deadline}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, deadline: event.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetEditDialog} disabled={Boolean(editingTask && actionLoadingKey === `edit-${editingTask.id}`)}>
                Annuler
              </Button>
              <Button type="submit" disabled={Boolean(editingTask && actionLoadingKey === `edit-${editingTask.id}`)}>
                {editingTask && actionLoadingKey === `edit-${editingTask.id}` ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mise a jour...
                  </>
                ) : (
                  <>
                    <SquarePen className="h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetReviewDialog()
            return
          }
          setReviewDialogOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review de la soumission</DialogTitle>
            <DialogDescription>
              {reviewTask ? `Soumission de "${reviewTask.title}" par ${reviewTask.stagiaireName}.` : "Verification des livrables du stagiaire."}
            </DialogDescription>
          </DialogHeader>

          {isReviewLoading ? (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              Chargement de la soumission...
            </div>
          ) : (
            <div className="space-y-4">
              {reviewError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {reviewError}
                </div>
              )}

              {!reviewSubmission ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Aucune soumission detaillee n est disponible pour cette tache.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date de soumission</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{formatDateTime(reviewSubmission.submitted_at)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Derniere review: {formatDateTime(reviewSubmission.reviewed_at)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut precedent</p>
                      <div className="mt-1">
                        <SubmissionDecisionBadge decision={reviewSubmission.decision} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                      <a href={reviewSubmission.github_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ouvrir GitHub
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                      <a href={reviewSubmission.file_url} target="_blank" rel="noreferrer">
                        <FileText className="h-3.5 w-3.5" />
                        Ouvrir livrable
                      </a>
                    </Button>
                  </div>

                  {reviewSubmission.notes && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Notes du stagiaire</p>
                      <p className="mt-2 text-sm text-slate-700">{reviewSubmission.notes}</p>
                    </div>
                  )}

                  {reviewSubmission.review_feedback && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Dernier feedback encadreur</p>
                      <p className="mt-2 text-sm text-amber-900">{reviewSubmission.review_feedback}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="review_feedback">Feedback encadreur</Label>
                    <Textarea
                      id="review_feedback"
                      value={reviewFeedback}
                      onChange={(event) => setReviewFeedback(event.target.value)}
                      rows={5}
                      placeholder="Precisez ce qui est valide, ce qui doit etre corrige ou les ajustements attendus."
                      disabled={isReviewSubmitting}
                    />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetReviewDialog} disabled={isReviewSubmitting}>
                      Fermer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => void submitReview("changes_requested")}
                      disabled={isReviewSubmitting}
                    >
                      {isReviewSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
                      Demander corrections
                    </Button>
                    <Button type="button" onClick={() => void submitReview("approved")} disabled={isReviewSubmitting}>
                      {isReviewSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approuver
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
