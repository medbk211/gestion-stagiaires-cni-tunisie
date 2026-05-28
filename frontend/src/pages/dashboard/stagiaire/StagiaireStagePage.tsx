import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Mail,
  RefreshCw,
  Target,
  AlertCircle,
  User2,
  Wrench,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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

interface ProjetStageRead {
  id: number
  code_projet: string
  intitule: string
  departement: string
  type_stage: string
  description: string
  objectifs: string
  livrables: string
  duree_semaines: number
  charge_hebdo: number
  niveau_requis: string
  competences: string[]
  tags: string[]
  status: string
}

interface EncadreurResponse {
  id: number
  nom: string
  prenom: string
  email: string
  grade: string
  departement: string | null
  actif_encadrement: boolean
  max_stagiaires: number
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

function normalizeTaskStatus(value: string | null | undefined): "todo" | "in_progress" | "done" | "validated" {
  const normalized = (value || "").toLowerCase()
  if (normalized === "in_progress" || normalized === "done" || normalized === "validated") {
    return normalized
  }
  return "todo"
}

function getDaysRemaining(endDate: string | null | undefined): number | null {
  const parsed = parseDate(endDate)
  if (!parsed) {
    return null
  }
  const diffMs = parsed.getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export default function StagiaireStagePage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole } = useStagiaireSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [stage, setStage] = useState<StageRead | null>(null)
  const [project, setProject] = useState<ProjetStageRead | null>(null)
  const [encadreur, setEncadreur] = useState<EncadreurResponse | null>(null)
  const [tasks, setTasks] = useState<TaskRead[]>([])

  const loadStageData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true
      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setPageError("")
      setDataWarning("")

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
        const [stageResult, tasksResult] = await Promise.allSettled([
          requestAuthJson<StageRead>("/Stages/me"),
          requestAuthJson<TaskRead[]>("/tasks/my-tasks"),
        ] as const)

        if (
          [stageResult, tasksResult].some(
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
          warnings.push(`Taches: ${asErrorMessage(tasksResult.reason, "indisponibles")}`)
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

        setStage(nextStage)
        setProject(nextProject)
        setEncadreur(nextEncadreur)
        setTasks(nextTasks)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement du stage impossible pour le moment."))
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
    void loadStageData()
  }, [loadStageData])

  const stageTitle = project?.intitule || "Stage en cours"
  const stageDescription = project?.description || stage?.texte_objectif || "Aucun descriptif disponible pour le moment."
  const stageType = project?.type_stage ? enumToLabel(project.type_stage) : "Stage"
  const stageDepartement = project?.departement ? enumToLabel(project.departement) : "Departement non renseigne"
  const encadreurName = encadreur ? `${encadreur.prenom} ${encadreur.nom}`.trim() : stage?.encadreur_id ? `Encadreur #${stage.encadreur_id}` : "Non assigne"
  const encadreurInitials = encadreur ? `${encadreur.prenom?.[0] || ""}${encadreur.nom?.[0] || ""}`.toUpperCase() : "EN"
  const encadreurGrade = encadreur?.grade ? enumToLabel(encadreur.grade) : "Grade non renseigne"
  const encadreurDepartement = encadreur?.departement ? enumToLabel(encadreur.departement) : "Departement non renseigne"

  const normalizedTasks = useMemo(() => {
    const filtered = stage ? tasks.filter((task) => task.stage_id === stage.id) : tasks
    return filtered.map((task) => ({
      ...task,
      status: normalizeTaskStatus(task.status),
    }))
  }, [stage, tasks])

  const taskStats = useMemo(() => {
    const total = normalizedTasks.length
    const done = normalizedTasks.filter((task) => task.status === "done" || task.status === "validated").length
    const inProgress = normalizedTasks.filter((task) => task.status === "in_progress").length
    const todo = normalizedTasks.filter((task) => task.status === "todo").length
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, inProgress, todo, progressPct }
  }, [normalizedTasks])

  const sortedTasks = useMemo(() => {
    const statusOrder: Record<string, number> = { in_progress: 0, todo: 1, done: 2, validated: 3 }
    return [...normalizedTasks].sort((a, b) => {
      const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
      if (statusDiff !== 0) {
        return statusDiff
      }
      const dateA = parseDate(a.deadline)?.getTime() || 0
      const dateB = parseDate(b.deadline)?.getTime() || 0
      return dateA - dateB
    })
  }, [normalizedTasks])

  const milestones = useMemo(() => {
    const items: Array<{ label: string; date: string | null; done: boolean; overdue?: boolean }> = []
    if (stage?.date_debut) {
      items.push({
        label: "Debut du stage",
        date: stage.date_debut,
        done: parseDate(stage.date_debut)?.getTime() ? parseDate(stage.date_debut)!.getTime() <= Date.now() : false,
      })
    }
    normalizedTasks.forEach((task) => {
      if (!task.deadline) {
        return
      }
      const deadline = parseDate(task.deadline)
      const isDone = task.status === "done" || task.status === "validated"
      items.push({
        label: `Tache: ${task.title}`,
        date: task.deadline,
        done: isDone,
        overdue: !isDone && deadline ? deadline.getTime() < Date.now() : false,
      })
    })
    if (stage?.date_fin) {
      items.push({
        label: "Fin du stage",
        date: stage.date_fin,
        done: stage.statut_stage === "TERMINE",
      })
    }
    return items
      .sort((a, b) => {
        const aTime = parseDate(a.date)?.getTime() || 0
        const bTime = parseDate(b.date)?.getTime() || 0
        return aTime - bTime
      })
      .slice(0, 8)
  }, [normalizedTasks, stage?.date_debut, stage?.date_fin, stage?.statut_stage])

  const daysRemaining = useMemo(() => getDaysRemaining(stage?.date_fin), [stage?.date_fin])
  const technologies = project?.competences?.length
    ? project.competences
    : project?.tags?.length
      ? project.tags
      : []

  return (
    <DashboardShell role="stagiaire" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Mon Stage"
          subtitle={"Details complets de votre stage"}
          actions={(
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadStageData({ silent: true })}
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

        {dataWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {dataWarning}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement du stage...
          </div>
        ) : !stage ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Aucun stage actif n est associe a ce compte.
          </div>
        ) : (
          <>
            <Card className="shadow-sm border-accent/20 bg-accent/5">
              <CardContent className="py-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <Badge className="bg-accent/10 text-accent border-accent/20 text-xs mb-2">
                        {stageType}
                      </Badge>
                      <h3 className="text-xl font-bold text-foreground text-balance">{stageTitle}</h3>
                    </div>
                    {daysRemaining !== null && (
                      <Badge variant="outline" className="text-xs gap-1.5 py-1">
                        <Clock className="h-3 w-3" />
                        {daysRemaining >= 0 ? `${daysRemaining} jours restants` : `Depasse de ${Math.abs(daysRemaining)} jours`}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">{stageDescription}</p>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {stageDepartement}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User2 className="h-3.5 w-3.5" />
                      {encadreurName}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(stage.date_debut)} - {formatDate(stage.date_fin)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Progress value={taskStats.progressPct} className="h-2.5 flex-1" />
                    <span className="text-sm font-bold text-foreground">{taskStats.progressPct}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="shadow-sm">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Objectifs du stage</CardTitle>
                      <CardDescription>{taskStats.done}/{taskStats.total} completes</CardDescription>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                      <Target className="h-5 w-5 text-accent" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {sortedTasks.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        Aucune tache associee pour le moment.
                      </div>
                    ) : (
                      sortedTasks.map((task) => {
                        const isDone = task.status === "done" || task.status === "validated"
                        const isInProgress = task.status === "in_progress"
                        const deadlineLabel = task.deadline ? formatDate(task.deadline) : null
                        return (
                          <div
                            key={task.id}
                            className={`flex items-start gap-3 rounded-lg border p-3 ${
                              isInProgress ? "border-chart-5/30 bg-chart-5/5" : isDone ? "border-border/50 bg-secondary/20" : "border-border"
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                            ) : isInProgress ? (
                              <Clock className="h-4 w-4 text-chart-5 shrink-0 mt-0.5 animate-pulse" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <span className={`text-sm ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                {task.title}
                              </span>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                              )}
                              {deadlineLabel && (
                                <p className="text-xs text-muted-foreground mt-1">Deadline: {deadlineLabel}</p>
                              )}
                            </div>
                            {isInProgress && (
                              <Badge className="bg-chart-5/10 text-chart-5 border-chart-5/20 text-xs ml-auto shrink-0">
                                En cours
                              </Badge>
                            )}
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
                    <CardTitle className="text-base">Encadreur</CardTitle>
                    <CardDescription>Informations de votre encadreur de stage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                        {encadreurInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{encadreurName}</p>
                        <p className="text-xs text-muted-foreground">{encadreurGrade}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          encadreur?.actif_encadrement
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {encadreur?.actif_encadrement ? "Disponible" : "Indisponible"}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        {encadreur?.email || "Email non disponible"}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        {encadreurDepartement}
                      </p>
                      {encadreur?.max_stagiaires ? (
                        <p className="flex items-center gap-2">
                          <User2 className="h-3.5 w-3.5" />
                          Capacite max: {encadreur.max_stagiaires} stagiaire(s)
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Jalons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {milestones.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        Aucun jalon defini.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {milestones.map((m, i) => (
                          <div key={`${m.label}-${i}`} className="flex items-center gap-3">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${
                                m.done
                                  ? "bg-accent text-accent-foreground"
                                  : m.overdue
                                    ? "bg-red-50 text-red-600 border border-red-200"
                                    : "border-2 border-border bg-card text-muted-foreground"
                              }`}
                            >
                              {m.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-xs font-bold">{i + 1}</span>}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${m.done ? "text-foreground" : "text-muted-foreground"}`}>{m.label}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(m.date)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Technologies utilisees</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {technologies.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 w-full">
                        Aucune technologie renseignee.
                      </div>
                    ) : (
                      technologies.map((tech) => (
                        <div key={tech} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">{tech}</span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
