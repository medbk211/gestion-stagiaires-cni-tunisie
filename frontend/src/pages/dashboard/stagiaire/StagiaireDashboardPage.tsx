import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  SendHorizontal,
  Settings,
  Star,
  Target,
  UploadCloud,
  UserRound,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
import { cn } from "@/lib/utils"

type TaskStatus = "todo" | "in_progress" | "done" | "validated"
type TaskPriority = "low" | "medium" | "high"

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
  actif: boolean
  etablissement: string | null
  niveau_etude: string | null
  has_stagiaire_record: boolean
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

interface StagiaireProgressResponse {
  stagiaire_id: number
  stage_id: number | null
  tasks_total: number
  tasks_done: number
  tasks_in_progress: number
  tasks_todo: number
  retard: number
  progress_pct: number
  evaluations_count: number
  moyenne_note: number | null
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

interface DocumentRead {
  id: number
  type: string
  file_path: string
  created_at: string
  status: string
  review_comment: string | null
  reviewed_by: number | null
  reviewed_at: string | null
}

interface NotificationUnreadCount {
  unread_count: number
}

interface ProjetStageRead {
  id: number
  code_projet: string
  intitule: string
  departement: string
  type_stage: string
  description: string
  status: string
}

interface EncadreurResponse {
  id: number
  nom: string
  prenom: string
  email: string
  matricule: string
  grade: string
  departement: string | null
  actif_encadrement: boolean
  max_stagiaires: number
}

interface EvaluationRead {
  id: number
  stagiaire_id: number
  projet_id: number
  encadreur_id: number
  note: number
  commentaire: string | null
  created_at: string
  updated_at: string
}

interface AttestationRead {
  id: number
  stagiaire_id: number
  stage_id: number
  numero_attestation: string
  date_debut_stage: string
  date_fin_stage: string
  description: string | null
  created_at: string
  updated_at: string
}

interface NormalizedTask extends Omit<TaskRead, "status" | "priority"> {
  status: TaskStatus
  priority: TaskPriority
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

function normalizeDocumentStatus(value: string): "approved" | "rejected" | "pending" {
  const normalized = value.trim().toLowerCase()
  if (normalized.includes("approve") || normalized.includes("valid") || normalized.includes("accepte")) {
    return "approved"
  }
  if (normalized.includes("reject") || normalized.includes("refus")) {
    return "rejected"
  }
  return "pending"
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

function getDaysRemaining(endDate: string | null | undefined): number | null {
  const parsed = parseDate(endDate)
  if (!parsed) {
    return null
  }
  const diffMs = parsed.getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export default function StagiaireDashboardPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")

  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null)
  const [profile, setProfile] = useState<StagiaireProfileResponse | null>(null)
  const [stage, setStage] = useState<StageRead | null>(null)
  const [project, setProject] = useState<ProjetStageRead | null>(null)
  const [encadreur, setEncadreur] = useState<EncadreurResponse | null>(null)
  const [progress, setProgress] = useState<StagiaireProgressResponse | null>(null)
  const [tasks, setTasks] = useState<TaskRead[]>([])
  const [documents, setDocuments] = useState<DocumentRead[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationRead[]>([])
  const [attestations, setAttestations] = useState<AttestationRead[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const [taskActionId, setTaskActionId] = useState<number | null>(null)
  const [taskActionError, setTaskActionError] = useState("")

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

  const computedProgress = useMemo(() => {
    const fromTasks = normalizedTasks.length > 0

    const total = fromTasks ? normalizedTasks.length : (progress?.tasks_total || 0)
    const done = fromTasks
      ? normalizedTasks.filter((task) => task.status === "done" || task.status === "validated").length
      : (progress?.tasks_done || 0)
    const inProgress = fromTasks
      ? normalizedTasks.filter((task) => task.status === "in_progress").length
      : (progress?.tasks_in_progress || 0)
    const todo = fromTasks
      ? normalizedTasks.filter((task) => task.status === "todo").length
      : (progress?.tasks_todo || 0)
    const overdue = fromTasks
      ? normalizedTasks.filter((task) => isTaskOverdue(task)).length
      : (progress?.retard || 0)

    const pct = total > 0 ? Math.round((done / total) * 100) : (progress?.progress_pct || 0)
    return { total, done, inProgress, todo, overdue, pct }
  }, [normalizedTasks, progress])

  const documentStats = useMemo(() => {
    let approved = 0
    let pending = 0
    let rejected = 0

    for (const document of documents) {
      const status = normalizeDocumentStatus(document.status || "")
      if (status === "approved") {
        approved += 1
      } else if (status === "rejected") {
        rejected += 1
      } else {
        pending += 1
      }
    }

    return {
      total: documents.length,
      approved,
      pending,
      rejected,
    }
  }, [documents])

  const userName = useMemo(() => {
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
  }, [currentUser?.nom, currentUser?.prenom, profile?.nom, profile?.prenom])

  const userRole = useMemo(() => {
    const studyLevel = enumToLabel(profile?.niveau_etude)
    if (studyLevel !== "-") {
      return `Stagiaire ${studyLevel}`
    }
    return "Stagiaire"
  }, [profile?.niveau_etude])

  const encadreurName = useMemo(() => {
    if (encadreur) {
      return `${encadreur.prenom} ${encadreur.nom}`.trim()
    }
    if (stage?.encadreur_id) {
      return `Encadreur #${stage.encadreur_id}`
    }
    return "Non assigne"
  }, [encadreur, stage?.encadreur_id])

  const stageDaysRemaining = useMemo(() => getDaysRemaining(stage?.date_fin), [stage?.date_fin])

  const navItems = useMemo<NavItem[]>(
    () => [
      { label: "Tableau de bord", href: "/dashboard/stagiaire", icon: LayoutDashboard },
      { label: "Mon Projet", href: "/dashboard/stagiaire/stage", icon: Briefcase },
      { label: "Taches Kanban", href: "/dashboard/stagiaire/taches", icon: KanbanSquare },
      {
        label: "Documents",
        href: "/dashboard/stagiaire/documents",
        icon: FileText,
        badge: documentStats.total > 0 ? String(documentStats.total) : undefined,
      },
      {
        label: "Planification",
        href: "/dashboard/stagiaire/planning",
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
    ],
    [documentStats.total, unreadCount],
  )

  const resetSubmissionDialog = useCallback(() => {
    setSubmitDialogOpen(false)
    setSubmitTask(null)
    setGithubUrl("")
    setFileUrl("")
    setSubmissionNotes("")
    setSubmissionError("")
  }, [])

  const loadDashboard = useCallback(
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
        const [
          meResult,
          profileResult,
          stageResult,
          tasksResult,
          documentsResult,
          unreadCountResult,
          evaluationsResult,
          attestationsResult,
        ] = await Promise.allSettled([
          requestAuthJson<CurrentUserResponse>("/auth/me"),
          requestAuthJson<StagiaireProfileResponse>("/stagiaires/me/profile"),
          requestAuthJson<StageRead>("/Stages/me"),
          requestAuthJson<TaskRead[]>("/tasks/my-tasks"),
          requestAuthJson<DocumentRead[]>("/documents/me"),
          requestAuthJson<NotificationUnreadCount>("/notifications/me/unread-count"),
          requestAuthJson<EvaluationRead[]>("/evaluations/my"),
          requestAuthJson<AttestationRead[]>("/attestations/my"),
        ] as const)

        const initialResults = [
          meResult,
          profileResult,
          stageResult,
          tasksResult,
          documentsResult,
          unreadCountResult,
          evaluationsResult,
          attestationsResult,
        ]

        if (
          initialResults.some(
            (result) =>
              result.status === "rejected" &&
              isApiErrorStatus(result.reason, 401),
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
        if (profileResult.status === "rejected") {
          warnings.push(`Profil stagiaire: ${asErrorMessage(profileResult.reason, "indisponible")}`)
        }

        const nextStage = stageResult.status === "fulfilled" ? stageResult.value : null
        if (stageResult.status === "rejected" && !isApiErrorStatus(stageResult.reason, 404)) {
          warnings.push(`Stage: ${asErrorMessage(stageResult.reason, "indisponible")}`)
        }

        const nextTasks = tasksResult.status === "fulfilled" ? tasksResult.value : []
        if (tasksResult.status === "rejected") {
          warnings.push(`Taches: ${asErrorMessage(tasksResult.reason, "indisponibles")}`)
        }

        const nextDocuments = documentsResult.status === "fulfilled" ? documentsResult.value : []
        if (documentsResult.status === "rejected") {
          warnings.push(`Documents: ${asErrorMessage(documentsResult.reason, "indisponibles")}`)
        }

        const nextEvaluations = evaluationsResult.status === "fulfilled" ? evaluationsResult.value : []
        if (evaluationsResult.status === "rejected") {
          warnings.push(`Evaluations: ${asErrorMessage(evaluationsResult.reason, "indisponibles")}`)
        }

        const nextAttestations = attestationsResult.status === "fulfilled" ? attestationsResult.value : []
        if (attestationsResult.status === "rejected") {
          warnings.push(`Attestations: ${asErrorMessage(attestationsResult.reason, "indisponibles")}`)
        }

        const nextUnreadCount = unreadCountResult.status === "fulfilled" ? unreadCountResult.value.unread_count : 0
        if (unreadCountResult.status === "rejected") {
          warnings.push(`Notifications: ${asErrorMessage(unreadCountResult.reason, "indisponibles")}`)
        }

        let nextProgress: StagiaireProgressResponse | null = null
        const stagiaireId = nextProfile?.id || nextCurrentUser?.id
        if (stagiaireId) {
          try {
            nextProgress = await requestAuthJson<StagiaireProgressResponse>(`/stagiaires/${stagiaireId}/progress`)
          } catch (error) {
            if (isApiErrorStatus(error, 401)) {
              throw error
            }
            if (!isApiErrorStatus(error, 404)) {
              warnings.push(`Progression: ${asErrorMessage(error, "indisponible")}`)
            }
          }
        }

        let nextProject: ProjetStageRead | null = null
        if (nextStage?.id) {
          try {
            nextProject = await requestAuthJson<ProjetStageRead>(`/Project/projets/by-stage/${nextStage.id}`)
          } catch (error) {
            if (isApiErrorStatus(error, 401)) {
              throw error
            }
            if (!isApiErrorStatus(error, 404)) {
              warnings.push(`Projet: ${asErrorMessage(error, "indisponible")}`)
            }
          }
        }

        let nextEncadreur: EncadreurResponse | null = null
        if (nextStage?.encadreur_id) {
          try {
            nextEncadreur = await requestAuthJson<EncadreurResponse>(`/encadreur/${nextStage.encadreur_id}`)
          } catch (error) {
            if (isApiErrorStatus(error, 401)) {
              throw error
            }
            if (!isApiErrorStatus(error, 404)) {
              warnings.push(`Encadreur: ${asErrorMessage(error, "indisponible")}`)
            }
          }
        }

        if (nextCurrentUser) {
          localStorage.setItem("cni_user_email", nextCurrentUser.email)
          localStorage.setItem("cni_user_name", `${nextCurrentUser.prenom} ${nextCurrentUser.nom}`.trim())
        }

        setCurrentUser(nextCurrentUser)
        setProfile(nextProfile)
        setStage(nextStage)
        setTasks(nextTasks)
        setDocuments(nextDocuments)
        setEvaluations(nextEvaluations)
        setAttestations(nextAttestations)
        setUnreadCount(nextUnreadCount)
        setProgress(nextProgress)
        setProject(nextProject)
        setEncadreur(nextEncadreur)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement du dashboard impossible pour le moment."))
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
    void loadDashboard()
  }, [loadDashboard])

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
    <DashboardShell
      role="stagiaire"
      navItems={navItems}
      userName={userName}
      userRole={userRole}
    >
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Tableau de bord stagiaire"
          subtitle="Suivi temps reel du stage, des livrables et des taches."
          actions={(
            <Button
              variant="outline"
              onClick={() => void loadDashboard({ silent: true })}
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
                onClick={() => void loadDashboard()}
              >
                Reessayer
              </Button>
            </CardContent>
          </Card>
        )}

        {dataWarning && (
          <Card className="border-amber-200 bg-amber-50/70">
            <CardContent className="flex items-center gap-2 py-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{dataWarning}</span>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card className="border-indigo-100 bg-white/90">
            <CardContent className="flex min-h-[18rem] items-center justify-center gap-3 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              Chargement du dashboard stagiaire...
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progression</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-2xl font-bold text-foreground">{computedProgress.pct}%</span>
                    <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                      {computedProgress.done}/{computedProgress.total}
                    </Badge>
                  </div>
                  <Progress value={computedProgress.pct} className="mt-3 h-2" />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Taches en cours</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{computedProgress.inProgress}</span>
                    <Clock3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {computedProgress.todo} en attente, {computedProgress.overdue} en retard
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{documentStats.total}</span>
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {documentStats.approved} valides, {documentStats.pending} en attente
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alertes</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{unreadCount}</span>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {computedProgress.overdue > 0
                      ? `${computedProgress.overdue} tache(s) a traiter rapidement`
                      : "Aucun retard critique"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2 border-indigo-100 bg-white/95 shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        {project?.intitule || "Stage en cours"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {project?.description || stage?.texte_objectif || "Aucun descriptif disponible pour le moment."}
                      </CardDescription>
                    </div>
                    <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                      {stage ? enumToLabel(stage.statut_stage) : "Aucun stage actif"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!stage ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Aucun stage actif n est relie a ce compte. Verifiez votre affectation avec l administration.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Periode</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatDate(stage.date_debut)} - {formatDate(stage.date_fin)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {stageDaysRemaining !== null
                              ? stageDaysRemaining >= 0
                                ? `${stageDaysRemaining} jour(s) restants`
                                : `Stage depasse de ${Math.abs(stageDaysRemaining)} jour(s)`
                              : "Date de fin indisponible"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Encadreur</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{encadreurName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{encadreur?.email || "Email non disponible"}</p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avancement global</p>
                          <span className="text-sm font-semibold text-foreground">{computedProgress.pct}%</span>
                        </div>
                        <Progress value={computedProgress.pct} className="h-2.5" />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col gap-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Profil stagiaire</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{userName}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email || currentUser?.email || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{profile?.etablissement || "Etablissement non renseigne"}</p>
                        <p className="text-xs text-muted-foreground">{userRole}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Target className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">
                          {progress?.evaluations_count ?? 0} evaluation(s)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Moyenne: {progress?.moyenne_note !== null && progress?.moyenne_note !== undefined ? progress.moyenne_note : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Projet et documents</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projet</p>
                      <p className="mt-1 font-semibold text-foreground">{project?.code_projet || "Non assigne"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {project ? `${enumToLabel(project.departement)} - ${enumToLabel(project.type_stage)}` : "Aucun projet relie a ce stage"}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                        <p className="text-xs font-semibold text-emerald-700">{documentStats.approved}</p>
                        <p className="text-[11px] text-emerald-700/80">Valides</p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
                        <p className="text-xs font-semibold text-amber-700">{documentStats.pending}</p>
                        <p className="text-[11px] text-amber-700/80">En attente</p>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-center">
                        <p className="text-xs font-semibold text-red-700">{documentStats.rejected}</p>
                        <p className="text-[11px] text-red-700/80">Refuses</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {evaluations.length > 0 && (
              <Card className="border-indigo-100 bg-white/95 shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        Mes Evaluations
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {evaluations.length} evaluation(s) recue(s)
                      </CardDescription>
                    </div>
                    <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                      Moy: {evaluations.length > 0 ? (evaluations.reduce((sum, e) => sum + e.note, 0) / evaluations.length).toFixed(2) : "-"}/20
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {evaluations.map((evaluation) => (
                      <div key={evaluation.id} className="flex items-start justify-between gap-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              Evaluation #{evaluation.id}
                            </span>
                            <Badge className="border-indigo-300 bg-indigo-100 text-indigo-800">
                              {formatDateTime(evaluation.created_at)}
                            </Badge>
                          </div>
                          {evaluation.commentaire && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {evaluation.commentaire}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            <span className="text-2xl font-bold text-foreground">{evaluation.note}</span>
                            <span className="text-xs text-muted-foreground">/20</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {attestations.length > 0 && (
              <Card className="border-emerald-100 bg-white/95 shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        Mes Attestations
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {attestations.length} attestation(s) disponible(s)
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {attestations.map((attestation) => (
                      <div key={attestation.id} className="flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-emerald-600" />
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {attestation.numero_attestation}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Du {formatDate(attestation.date_debut_stage)} au {formatDate(attestation.date_fin_stage)}
                          </p>
                          {attestation.description && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {attestation.description}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const a = document.createElement("a")
                            a.href = `/attestations/${attestation.id}/download`
                            a.download = `${attestation.numero_attestation}.pdf`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                          }}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Télécharger
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            
          </>
        )}
      </div>

    
    </DashboardShell>
  )
}
