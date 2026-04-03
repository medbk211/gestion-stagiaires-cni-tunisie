import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  UserRound,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
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
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useEncadrantSidebar } from "@/hooks/use-encadrant-sidebar"

type TaskStatus = "todo" | "in_progress" | "done" | "validated"

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

interface StagiaireRead {
  id: number
  nom: string
  prenom: string
  email: string
  type_stage: string
  statut_stage: string
  etablissement: string
  niveau_etude?: string | null
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

interface EvaluationFormState {
  stagiaire_id: string
  note: string
  commentaire: string
}

interface EvaluationCandidate {
  stagiaire: StagiaireRead
  stage: StageRead | null
  taskTotal: number
  taskCompleted: number
  taskInReview: number
  taskValidated: number
  progressPct: number
  canEvaluate: boolean
  blockedReason: string | null
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

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

function fullName(prenom: string | null | undefined, nom: string | null | undefined): string {
  return `${prenom || ""} ${nom || ""}`.trim()
}

function normalizeTaskStatus(value: string): TaskStatus {
  const normalized = value.trim().toLowerCase()
  if (normalized === "todo" || normalized === "in_progress" || normalized === "done" || normalized === "validated") {
    return normalized
  }
  return "todo"
}

function isCompletedTask(status: TaskStatus): boolean {
  return status === "done" || status === "validated"
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

export default function EncadrantEvaluationsPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useEncadrantSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [evaluations, setEvaluations] = useState<EvaluationRead[]>([])
  const [stagiaires, setStagiaires] = useState<StagiaireRead[]>([])
  const [stages, setStages] = useState<StageRead[]>([])
  const [tasks, setTasks] = useState<TaskRead[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createForm, setCreateForm] = useState<EvaluationFormState>({
    stagiaire_id: "",
    note: "",
    commentaire: "",
  })

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
      setActionSuccess("")

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
        const [evaluationsResult, stagiairesResult, stagesResult, tasksResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<EvaluationRead[]>("/evaluations/my"),
          requestAuthJson<StagiaireRead[]>("/encadreur/me/stagiaires"),
          requestAuthJson<StageRead[]>("/Stages/my-interns"),
          requestAuthJson<TaskRead[]>("/tasks/my-tasks"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [evaluationsResult, stagiairesResult, stagesResult, tasksResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (evaluationsResult.status === "rejected") {
          throw evaluationsResult.reason
        }

        const warnings: string[] = []

        setEvaluations(evaluationsResult.value || [])

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

        if (tasksResult.status === "fulfilled") {
          setTasks(tasksResult.value)
        } else {
          setTasks([])
          warnings.push(`Taches: ${asErrorMessage(tasksResult.reason, "indisponibles")}`)
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
        setPageError(asErrorMessage(error, "Chargement des evaluations impossible pour le moment."))
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

  const stagiaireById = useMemo(() => {
    return stagiaires.reduce<Record<number, StagiaireRead>>((acc, stagiaire) => {
      acc[stagiaire.id] = stagiaire
      return acc
    }, {})
  }, [stagiaires])

  const stageByStagiaire = useMemo(() => {
    return stages.reduce<Record<number, StageRead>>((acc, stage) => {
      acc[stage.stagiaire_id] = pickPreferredStage(acc[stage.stagiaire_id], stage)
      return acc
    }, {})
  }, [stages])

  const tasksByStage = useMemo(() => {
    return tasks.reduce<Record<number, TaskRead[]>>((acc, task) => {
      if (!acc[task.stage_id]) {
        acc[task.stage_id] = []
      }
      acc[task.stage_id].push(task)
      return acc
    }, {})
  }, [tasks])

  const evaluatedStageKeys = useMemo(() => {
    return new Set(evaluations.map((evaluation) => `${evaluation.stagiaire_id}:${evaluation.projet_id}`))
  }, [evaluations])

  const candidateItems = useMemo<EvaluationCandidate[]>(() => {
    return stagiaires
      .map((stagiaire) => {
        const stage = stageByStagiaire[stagiaire.id] || null
        const stageTasks = stage ? tasksByStage[stage.id] || [] : []
        const normalizedStatuses = stageTasks.map((task) => normalizeTaskStatus(task.status))
        const taskTotal = normalizedStatuses.length
        const taskCompleted = normalizedStatuses.filter((status) => isCompletedTask(status)).length
        const taskInReview = normalizedStatuses.filter((status) => status === "done").length
        const taskValidated = normalizedStatuses.filter((status) => status === "validated").length
        const alreadyEvaluated = Boolean(stage?.projet_id && evaluatedStageKeys.has(`${stagiaire.id}:${stage.projet_id}`))

        let blockedReason: string | null = null
        if (!stage) {
          blockedReason = "Aucun stage actif"
        } else if (!stage.projet_id) {
          blockedReason = "Projet non affecte"
        } else if (taskTotal === 0) {
          blockedReason = "Aucune tache assignee"
        } else if (taskCompleted < taskTotal) {
          blockedReason = `${taskCompleted}/${taskTotal} taches completees`
        } else if (alreadyEvaluated) {
          blockedReason = "Evaluation deja publiee"
        }

        return {
          stagiaire,
          stage,
          taskTotal,
          taskCompleted,
          taskInReview,
          taskValidated,
          progressPct: taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0,
          canEvaluate: Boolean(stage?.projet_id && taskTotal > 0 && taskCompleted === taskTotal && !alreadyEvaluated),
          blockedReason,
        }
      })
      .sort((a, b) => {
        if (a.canEvaluate !== b.canEvaluate) {
          return a.canEvaluate ? -1 : 1
        }
        if (a.progressPct !== b.progressPct) {
          return b.progressPct - a.progressPct
        }
        return fullName(a.stagiaire.prenom, a.stagiaire.nom).localeCompare(fullName(b.stagiaire.prenom, b.stagiaire.nom))
      })
  }, [evaluatedStageKeys, stageByStagiaire, stagiaires, tasksByStage])

  const readyCandidates = useMemo(
    () => candidateItems.filter((candidate) => candidate.canEvaluate),
    [candidateItems],
  )

  const blockedCandidates = useMemo(
    () => candidateItems.filter((candidate) => !candidate.canEvaluate && candidate.blockedReason !== "Evaluation deja publiee"),
    [candidateItems],
  )

  const selectedCandidate = useMemo(() => {
    return readyCandidates.find((candidate) => String(candidate.stagiaire.id) === createForm.stagiaire_id) || null
  }, [createForm.stagiaire_id, readyCandidates])

  const evaluationItems = useMemo(() => {
    return evaluations
      .slice()
      .sort((a, b) => {
        const aDate = parseDate(a.created_at)?.getTime() || 0
        const bDate = parseDate(b.created_at)?.getTime() || 0
        return bDate - aDate
      })
      .map((evaluation) => {
        const stagiaire = stagiaireById[evaluation.stagiaire_id]
        return {
          evaluation,
          stagiaire,
          fullName: stagiaire ? fullName(stagiaire.prenom, stagiaire.nom) : `Stagiaire #${evaluation.stagiaire_id}`,
          stageType: stagiaire ? enumToLabel(stagiaire.type_stage) : "-",
          progressPct: Math.min(100, Math.max(0, Math.round((evaluation.note / 20) * 100))),
          dateLabel: formatDate(evaluation.created_at),
        }
      })
  }, [evaluations, stagiaireById])

  const stats = useMemo(() => {
    const total = evaluations.length
    const average = total > 0
      ? (evaluations.reduce((sum, evaluation) => sum + evaluation.note, 0) / total).toFixed(1)
      : "-"

    return {
      total,
      ready: readyCandidates.length,
      blocked: blockedCandidates.length,
      average,
    }
  }, [blockedCandidates.length, evaluations, readyCandidates.length])

  const combinedWarning = dataWarning || sidebarWarning

  const openCreateDialog = useCallback(
    (candidate?: EvaluationCandidate) => {
      const fallback = candidate || readyCandidates[0] || null
      setCreateError("")
      setCreateForm({
        stagiaire_id: fallback ? String(fallback.stagiaire.id) : "",
        note: "",
        commentaire: "",
      })
      setCreateDialogOpen(true)
    },
    [readyCandidates],
  )

  const resetCreateDialog = useCallback(() => {
    setCreateDialogOpen(false)
    setCreateError("")
    setCreateForm({
      stagiaire_id: "",
      note: "",
      commentaire: "",
    })
  }, [])

  const handleCreateEvaluation = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!selectedCandidate?.stage?.projet_id) {
        setCreateError("Selectionnez un stagiaire pret a etre evalue.")
        return
      }

      const noteValue = Number(createForm.note)
      if (!Number.isFinite(noteValue) || noteValue < 0 || noteValue > 20) {
        setCreateError("La note doit etre comprise entre 0 et 20.")
        return
      }

      setCreateError("")
      setActionSuccess("")
      setIsSubmitting(true)

      try {
        await requestAuthJson<EvaluationRead>("/evaluations/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stagiaire_id: selectedCandidate.stagiaire.id,
            projet_id: selectedCandidate.stage.projet_id,
            note: Math.round(noteValue),
            commentaire: createForm.commentaire.trim() || null,
          }),
        })

        resetCreateDialog()
        await loadPage({ silent: true })
        setActionSuccess(`Evaluation ajoutee pour ${fullName(selectedCandidate.stagiaire.prenom, selectedCandidate.stagiaire.nom)}.`)
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setCreateError(asErrorMessage(error, "Creation de l evaluation impossible pour le moment."))
      } finally {
        setIsSubmitting(false)
      }
    },
    [createForm.commentaire, createForm.note, loadPage, navigate, resetCreateDialog, selectedCandidate],
  )

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Evaluations"
          subtitle={"Evaluez un stagiaire des que toutes ses taches sont completees."}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openCreateDialog()} disabled={readyCandidates.length === 0 || isLoading} className="text-xs">
                <Plus className="h-3.5 w-3.5" />
                Nouvelle evaluation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadPage({ silent: true })}
                disabled={isLoading || isRefreshing}
                className="text-xs"
              >
                {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Actualiser
              </Button>
            </div>
          )}
        />

        {pageError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {pageError}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {actionSuccess}
          </div>
        )}

        {combinedWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {combinedWarning}
          </div>
        )}

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Evaluations publiees</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Pretes a noter</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.ready}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Encore bloquees</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{stats.blocked}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Moyenne</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stats.average}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des evaluations...
          </div>
        ) : (
          <>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Stagiaires prets a etre evalues</CardTitle>
                <CardDescription>
                  L evaluation devient disponible quand toutes les taches du stage sont completees.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {readyCandidates.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Aucun stagiaire n a encore complete toutes ses taches.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {readyCandidates.map((candidate) => (
                      <div key={candidate.stagiaire.id} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{fullName(candidate.stagiaire.prenom, candidate.stagiaire.nom)}</p>
                              <Badge variant="secondary" className="text-[11px]">{enumToLabel(candidate.stagiaire.type_stage)}</Badge>
                              {candidate.stage?.projet_id && <Badge variant="outline" className="text-[11px]">Projet #{candidate.stage.projet_id}</Badge>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{candidate.stagiaire.email}</span>
                              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Fin: {formatDate(candidate.stage?.date_fin)}</span>
                            </div>
                          </div>
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Pret a evaluer
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-lg border border-emerald-200 bg-white p-2 text-center">
                            <p className="text-xs font-semibold text-foreground">{candidate.taskCompleted}/{candidate.taskTotal}</p>
                            <p className="text-[11px] text-muted-foreground">Completees</p>
                          </div>
                          <div className="rounded-lg border border-indigo-200 bg-white p-2 text-center">
                            <p className="text-xs font-semibold text-foreground">{candidate.taskInReview}</p>
                            <p className="text-[11px] text-muted-foreground">En review</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                            <p className="text-xs font-semibold text-foreground">{candidate.taskValidated}</p>
                            <p className="text-[11px] text-muted-foreground">Validees</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Progression des taches</span>
                            <span>{candidate.progressPct}%</span>
                          </div>
                          <Progress value={candidate.progressPct} className="h-2.5" />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" className="text-xs" onClick={() => openCreateDialog(candidate)}>
                            <Star className="h-3.5 w-3.5" />
                            Evaluer
                          </Button>
                          <Button asChild size="sm" variant="outline" className="text-xs">
                            <Link to={`/dashboard/encadrant/taches?stagiaire=${candidate.stagiaire.id}`}>
                              <ClipboardList className="h-3.5 w-3.5" />
                              Voir taches
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Stagiaires pas encore prets</CardTitle>
                <CardDescription>Suivez ce qui manque avant l evaluation finale.</CardDescription>
              </CardHeader>
              <CardContent>
                {blockedCandidates.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Tous les stagiaires relies sont soit prets a etre evalues, soit deja notes.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {blockedCandidates.map((candidate) => (
                      <div key={candidate.stagiaire.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{fullName(candidate.stagiaire.prenom, candidate.stagiaire.nom)}</p>
                              <Badge variant="secondary" className="text-[11px]">{enumToLabel(candidate.stagiaire.type_stage)}</Badge>
                              {candidate.stage?.projet_id && <Badge variant="outline" className="text-[11px]">Projet #{candidate.stage.projet_id}</Badge>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{candidate.stagiaire.email}</span>
                              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Fin: {formatDate(candidate.stage?.date_fin)}</span>
                            </div>
                          </div>
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            {candidate.blockedReason || "En attente"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Progression des taches</span>
                            <span>{candidate.progressPct}%</span>
                          </div>
                          <Progress value={candidate.progressPct} className="h-2.5" />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline" className="text-xs">
                            <Link to={`/dashboard/encadrant/taches?stagiaire=${candidate.stagiaire.id}`}>
                              <ClipboardList className="h-3.5 w-3.5" />
                              Suivre taches
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Evaluations publiees</CardTitle>
                <CardDescription>Historique des notes et commentaires deja enregistres.</CardDescription>
              </CardHeader>
              <CardContent>
                {evaluationItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Aucune evaluation disponible pour le moment.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {evaluationItems.map(({ evaluation, stagiaire, fullName: label, stageType, progressPct, dateLabel }) => (
                      <div key={evaluation.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground text-sm">{label}</p>
                              {stagiaire && <Badge variant="secondary" className="text-xs py-0">{stageType}</Badge>}
                              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs py-0">Publiee</Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{dateLabel}</span>
                              <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" />Projet #{evaluation.projet_id}</span>
                            </div>
                            {evaluation.commentaire && <p className="mt-3 text-sm text-foreground leading-relaxed">{evaluation.commentaire}</p>}
                          </div>

                          <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:w-32 shrink-0">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-foreground">{evaluation.note}</p>
                              <p className="text-xs text-muted-foreground">/20</p>
                            </div>
                            <Progress value={progressPct} className="h-2 w-24" />
                          </div>
                        </div>
                      </div>
                    ))}
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
            <DialogTitle>Nouvelle evaluation</DialogTitle>
            <DialogDescription>
              Attribuez une note finale a un stagiaire qui a complete toutes ses taches.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateEvaluation}>
            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {createError}
              </div>
            )}

            {readyCandidates.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Aucun stagiaire n est encore pret a etre evalue.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="evaluation_stagiaire">Stagiaire</Label>
              <select
                id="evaluation_stagiaire"
                className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm")}
                value={createForm.stagiaire_id}
                onChange={(event) => setCreateForm((previous) => ({ ...previous, stagiaire_id: event.target.value }))}
                disabled={readyCandidates.length === 0 || isSubmitting}
              >
                <option value="">Selectionner un stagiaire</option>
                {readyCandidates.map((candidate) => (
                  <option key={candidate.stagiaire.id} value={String(candidate.stagiaire.id)}>
                    {fullName(candidate.stagiaire.prenom, candidate.stagiaire.nom)}
                  </option>
                ))}
              </select>
              {selectedCandidate?.stage && (
                <p className="text-[11px] text-muted-foreground">
                  Projet #{selectedCandidate.stage.projet_id} • {selectedCandidate.taskCompleted}/{selectedCandidate.taskTotal} taches completees
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="evaluation_note">Note finale</Label>
              <Input
                id="evaluation_note"
                type="number"
                min={0}
                max={20}
                step={1}
                value={createForm.note}
                onChange={(event) => setCreateForm((previous) => ({ ...previous, note: event.target.value }))}
                placeholder="Ex: 16"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evaluation_commentaire">Commentaire</Label>
              <Textarea
                id="evaluation_commentaire"
                value={createForm.commentaire}
                onChange={(event) => setCreateForm((previous) => ({ ...previous, commentaire: event.target.value }))}
                rows={5}
                placeholder="Feedback global, points forts, axes d amelioration..."
                disabled={isSubmitting}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCreateDialog} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedCandidate}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publication...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Publier evaluation
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
