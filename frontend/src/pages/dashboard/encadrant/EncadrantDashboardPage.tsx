import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquare,
  RefreshCw,
  Star,
  TrendingUp,
  Users,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useEncadrantSidebar } from "@/hooks/use-encadrant-sidebar"

interface CurrentUserResponse {
  id: number
  email: string
  nom: string
  prenom: string
  role: string
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
  type_stage: string
  statut_stage: string
  etablissement: string
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

interface EncadreurOverviewRead {
  totaux: {
    stages: number
    tasks: number
    tasks_validated: number
    tasks_in_review: number
    evaluations: number
  }
}

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

function getDaysRemaining(endDate: string | null | undefined): number | null {
  const parsed = parseDate(endDate)
  if (!parsed) {
    return null
  }
  const diffMs = parsed.getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
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

function StatusTag({ status }: { status?: string | null }) {
  const resolved = status || "EN_ATTENTE"
  const config: Record<string, { label: string; className: string }> = {
    EN_COURS: { label: "En cours", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    EN_ATTENTE: { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" },
    TERMINE: { label: "Termine", className: "bg-slate-100 text-slate-700 border-slate-200" },
    ANNULE: { label: "Annule", className: "bg-red-50 text-red-700 border-red-200" },
  }
  const meta = config[resolved] || config.EN_ATTENTE

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function AgendaTypeBadge({ type }: { type: string }) {
  const className =
    type === "deadline"
      ? "bg-red-100 text-red-700"
      : type === "review"
        ? "bg-amber-100 text-amber-700"
        : type === "visit"
          ? "bg-violet-100 text-violet-700"
          : "bg-blue-100 text-blue-700"
  return <span className={`h-2 w-2 rounded-full ${className}`} />
}

export default function EncadrantDashboardPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning } = useEncadrantSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")

  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null)
  const [stagiaires, setStagiaires] = useState<StagiaireRead[]>([])
  const [stages, setStages] = useState<StageRead[]>([])
  const [overview, setOverview] = useState<EncadreurOverviewRead | null>(null)
  const [planning, setPlanning] = useState<PlanningWeekOverview | null>(null)
  const [progressByStagiaire, setProgressByStagiaire] = useState<Record<number, StagiaireProgressResponse>>({})

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
        const [meResult, stagiairesResult, stagesResult, overviewResult, planningResult] = await Promise.allSettled([
          requestAuthJson<CurrentUserResponse>("/auth/me"),
          requestAuthJson<StagiaireRead[]>("/encadreur/me/stagiaires"),
          requestAuthJson<StageRead[]>("/Stages/my-interns"),
          requestAuthJson<EncadreurOverviewRead>("/statistiques/encadreur/overview"),
          requestAuthJson<PlanningWeekOverview>("/planning/overview"),
        ] as const)

        const initialResults = [meResult, stagiairesResult, stagesResult, overviewResult, planningResult]
        if (
          initialResults.some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (stagiairesResult.status === "rejected") {
          throw stagiairesResult.reason
        }

        const warnings: string[] = []
        const nextMe = meResult.status === "fulfilled" ? meResult.value : null
        if (meResult.status === "rejected") {
          warnings.push(`Utilisateur: ${asErrorMessage(meResult.reason, "indisponible")}`)
        }

        const nextStagiaires = stagiairesResult.value || []
        const nextStages = stagesResult.status === "fulfilled" ? stagesResult.value : []
        if (stagesResult.status === "rejected") {
          warnings.push(`Stages: ${asErrorMessage(stagesResult.reason, "indisponibles")}`)
        }

        const nextOverview = overviewResult.status === "fulfilled" ? overviewResult.value : null
        if (overviewResult.status === "rejected") {
          warnings.push(`Statistiques: ${asErrorMessage(overviewResult.reason, "indisponibles")}`)
        }

        const nextPlanning = planningResult.status === "fulfilled" ? planningResult.value : null
        if (planningResult.status === "rejected") {
          warnings.push(`Planning: ${asErrorMessage(planningResult.reason, "indisponible")}`)
        }

        const progressResults = await Promise.allSettled(
          nextStagiaires.map((stagiaire) =>
            requestAuthJson<StagiaireProgressResponse>(`/stagiaires/${stagiaire.id}/progress`),
          ),
        )

        const nextProgressMap: Record<number, StagiaireProgressResponse> = {}
        progressResults.forEach((result, index) => {
          const stagiaire = nextStagiaires[index]
          if (result.status === "fulfilled") {
            nextProgressMap[stagiaire.id] = result.value
          } else if (
            !isApiErrorStatus(result.reason, 404) &&
            !isApiErrorStatus(result.reason, 403)
          ) {
            warnings.push(
              `Progression ${stagiaire.prenom} ${stagiaire.nom}: ${asErrorMessage(result.reason, "indisponible")}`,
            )
          }
        })

        if (nextMe) {
          localStorage.setItem("cni_user_name", `${nextMe.prenom} ${nextMe.nom}`.trim())
          localStorage.setItem("cni_user_email", nextMe.email)
          localStorage.setItem("cni_user_role", nextMe.role)
        }

        setCurrentUser(nextMe)
        setStagiaires(nextStagiaires)
        setStages(nextStages)
        setOverview(nextOverview)
        setPlanning(nextPlanning)
        setProgressByStagiaire(nextProgressMap)
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

  const stageByStagiaire = useMemo(() => {
    const map: Record<number, StageRead> = {}
    for (const stage of stages) {
      map[stage.stagiaire_id] = pickPreferredStage(map[stage.stagiaire_id], stage)
    }
    return map
  }, [stages])

  const internCards = useMemo(() => {
    return stagiaires.map((stagiaire) => {
      const stage = stageByStagiaire[stagiaire.id]
      const progress = progressByStagiaire[stagiaire.id]
      const progressPct = progress?.progress_pct ?? 0
      const tasksDone = progress?.tasks_done ?? 0
      const tasksTotal = progress?.tasks_total ?? 0

      return {
        stagiaire,
        stage,
        fullName: `${stagiaire.prenom} ${stagiaire.nom}`.trim(),
        subject: stage?.texte_objectif || "Objectif de stage non renseigne",
        progressPct,
        tasksDone,
        tasksTotal,
        evaluationsCount: progress?.evaluations_count ?? 0,
      }
    })
  }, [stagiaires, stageByStagiaire, progressByStagiaire])

  const stats = useMemo(() => {
    const activeInterns = stagiaires.length
    const averageProgress = internCards.length > 0
      ? Math.round(internCards.reduce((sum, item) => sum + item.progressPct, 0) / internCards.length)
      : 0

    const evaluations = overview?.totaux?.evaluations
      ?? internCards.reduce((sum, item) => sum + item.evaluationsCount, 0)

    const endingThisMonth = stages.filter((stage) => {
      const endDate = parseDate(stage.date_fin)
      if (!endDate) {
        return false
      }
      const now = new Date()
      return (
        endDate.getFullYear() === now.getFullYear() &&
        endDate.getMonth() === now.getMonth()
      )
    }).length

    return { activeInterns, averageProgress, evaluations, endingThisMonth }
  }, [internCards, overview?.totaux?.evaluations, stagiaires.length, stages])

  const agendaItems = useMemo(() => {
    const items: Array<{ id: string; title: string; date: string; type: string; helper: string }> = []

    planning?.events.forEach((event) => {
      items.push({
        id: `event-${event.id}`,
        title: event.title,
        date: event.start_at,
        type: event.event_type || "meeting",
        helper: event.attendee_name || event.location || "Evenement planning",
      })
    })

    planning?.deadlines.forEach((deadline) => {
      items.push({
        id: `deadline-${deadline.task_id}`,
        title: `Deadline: ${deadline.title}`,
        date: deadline.deadline,
        type: "deadline",
        helper: deadline.stagiaire_nom_complet || `Stage #${deadline.stage_id}`,
      })
    })

    return items
      .sort((a, b) => (parseDate(a.date)?.getTime() || 0) - (parseDate(b.date)?.getTime() || 0))
      .slice(0, 8)
  }, [planning?.deadlines, planning?.events])

  const welcomeName = useMemo(() => {
    const fromUser = currentUser ? `${currentUser.prenom} ${currentUser.nom}`.trim() : ""
    if (fromUser) {
      return fromUser
    }
    return userName
  }, [currentUser, userName])

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title={`Bonjour, ${welcomeName}`}
          subtitle={`Vous encadrez actuellement ${stats.activeInterns} stagiaire(s).`}
          actions={(
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard({ silent: true })}
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

        {sidebarWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {sidebarWarning}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement du tableau de bord...
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stagiaires actifs</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stats.activeInterns}</p>
                    </div>
                    <div className="rounded-xl bg-secondary p-2.5 text-blue-600">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progression moyenne</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stats.averageProgress}%</p>
                    </div>
                    <div className="rounded-xl bg-secondary p-2.5 text-emerald-600">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Evaluations</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stats.evaluations}</p>
                    </div>
                    <div className="rounded-xl bg-secondary p-2.5 text-amber-600">
                      <Star className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fins ce mois</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stats.endingThisMonth}</p>
                    </div>
                    <div className="rounded-xl bg-secondary p-2.5 text-violet-600">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="shadow-sm">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Mes stagiaires</CardTitle>
                      <CardDescription>Suivi de la progression et des objectifs.</CardDescription>
                    </div>
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link to="/dashboard/encadrant/stagiaires">Voir tout</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {internCards.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        Aucun stagiaire associe pour le moment.
                      </div>
                    ) : (
                      internCards.map((item) => {
                        const daysRemaining = getDaysRemaining(item.stage?.date_fin)
                        return (
                          <div key={item.stagiaire.id} className="rounded-lg border border-border p-4 transition-colors hover:bg-secondary/30">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">{item.fullName}</p>
                                  <StatusTag status={item.stage?.statut_stage || item.stagiaire.statut_stage} />
                                </div>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subject}</p>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {enumToLabel(item.stagiaire.type_stage)}
                              </Badge>
                            </div>

                            <div className="mt-3 flex items-center gap-3">
                              <Progress value={item.progressPct} className="h-2 flex-1" />
                              <span className="w-10 text-right text-xs font-semibold text-foreground">{item.progressPct}%</span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>
                                {formatDate(item.stage?.date_debut)} - {formatDate(item.stage?.date_fin)}
                                {daysRemaining !== null ? ` · ${daysRemaining >= 0 ? `${daysRemaining}j restants` : `${Math.abs(daysRemaining)}j depasse`}` : ""}
                              </span>
                              <span>{item.tasksDone}/{item.tasksTotal} taches terminees</span>
                            </div>

                            <div className="mt-2 flex items-center gap-1">
                              <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                                <Link to={`/dashboard/encadrant/stagiaires/${item.stagiaire.id}`}>
                                  <FileText className="h-3 w-3" />
                                  Fiche
                                </Link>
                              </Button>
                              <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                                <Link to="/dashboard/encadrant/messages">
                                  <MessageSquare className="h-3 w-3" />
                                  Message
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Agenda</CardTitle>
                  <CardDescription>Planning et deadlines a venir.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {agendaItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Aucun evenement planifie.
                    </div>
                  ) : (
                    agendaItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/30">
                        <div className="mt-1">
                          <AgendaTypeBadge type={item.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(item.date)}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.helper}</p>
                        </div>
                      </div>
                    ))
                  )}

                  <Button asChild variant="outline" size="sm" className="mt-1 w-full text-xs">
                    <Link to="/dashboard/encadrant/planning">
                      <Calendar className="mr-1.5 h-3.5 w-3.5" />
                      Ouvrir planning complet
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{overview?.totaux?.stages ?? stages.length} stage(s)</p>
                    <p className="text-xs text-muted-foreground">Sous votre encadrement</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{overview?.totaux?.tasks_validated ?? 0} taches validees</p>
                    <p className="text-xs text-muted-foreground">Total de validations</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{overview?.totaux?.tasks_in_review ?? 0} taches en review</p>
                    <p className="text-xs text-muted-foreground">Soumises par les stagiaires</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
