import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  Loader2,
  MessageSquare,
  RefreshCw,
  Star,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useEncadrantSidebar } from "@/hooks/use-encadrant-sidebar"

interface StagiaireRead {
  id: number
  nom: string
  prenom: string
  email: string
  matricule: string
  type_stage: string
  statut_stage: string
  date_debut_stage: string
  date_fin_stage: string
  etablissement: string
  niveau_etude?: string | null
  encadreur_id?: number | null
  note_finale?: number | null
  date_validation?: string | null
  actif: boolean
  dateCreation: string
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

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const STATUS_META: Record<string, { label: string; className: string }> = {
  EN_COURS: { label: "En cours", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  EN_ATTENTE: { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  TERMINE: { label: "Termine", className: "bg-slate-100 text-slate-700 border-slate-200" },
  ANNULE: { label: "Annule", className: "bg-red-50 text-red-700 border-red-200" },
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

function getInitials(prenom: string, nom: string): string {
  const first = prenom?.trim()?.[0] || ""
  const second = nom?.trim()?.[0] || ""
  return `${first}${second}`.toUpperCase() || "ST"
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
  const meta = STATUS_META[resolved] || STATUS_META.EN_ATTENTE
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function EncadrantStagiairesPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole } = useEncadrantSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [stagiaires, setStagiaires] = useState<StagiaireRead[]>([])
  const [stageByStagiaire, setStageByStagiaire] = useState<Record<number, StageRead>>({})
  const [progressByStagiaire, setProgressByStagiaire] = useState<Record<number, StagiaireProgressResponse>>({})

  const loadStagiaires = useCallback(
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
        const [stagiairesResult, stagesResult] = await Promise.allSettled([
          requestAuthJson<StagiaireRead[]>("/encadreur/me/stagiaires"),
          requestAuthJson<StageRead[]>("/Stages/my-interns"),
        ] as const)

        if (
          [stagiairesResult, stagesResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (stagiairesResult.status === "rejected") {
          throw stagiairesResult.reason
        }

        const warnings: string[] = []
        const nextStagiaires = stagiairesResult.value || []
        const nextStages = stagesResult.status === "fulfilled" ? stagesResult.value : []
        if (stagesResult.status === "rejected") {
          warnings.push(`Stages: ${asErrorMessage(stagesResult.reason, "indisponibles")}`)
        }

        const stageMap: Record<number, StageRead> = {}
        for (const stage of nextStages) {
          stageMap[stage.stagiaire_id] = pickPreferredStage(stageMap[stage.stagiaire_id], stage)
        }

        const progressResults = await Promise.allSettled(
          nextStagiaires.map((stagiaire) =>
            requestAuthJson<StagiaireProgressResponse>(`/stagiaires/${stagiaire.id}/progress`),
          ),
        )

        const progressMap: Record<number, StagiaireProgressResponse> = {}
        progressResults.forEach((result, index) => {
          const stagiaire = nextStagiaires[index]
          if (result.status === "fulfilled") {
            progressMap[stagiaire.id] = result.value
          } else if (
            !isApiErrorStatus(result.reason, 404) &&
            !isApiErrorStatus(result.reason, 403)
          ) {
            warnings.push(
              `Progression ${stagiaire.prenom} ${stagiaire.nom}: ${asErrorMessage(result.reason, "indisponible")}`,
            )
          }
        })

        setStagiaires(nextStagiaires)
        setStageByStagiaire(stageMap)
        setProgressByStagiaire(progressMap)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement des stagiaires impossible pour le moment."))
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
    void loadStagiaires()
  }, [loadStagiaires])

  const cardItems = useMemo(() => {
    return stagiaires.map((stagiaire) => {
      const stage = stageByStagiaire[stagiaire.id]
      const progress = progressByStagiaire[stagiaire.id]
      const fullName = `${stagiaire.prenom} ${stagiaire.nom}`.trim()
      const subject = stage?.texte_objectif || "Objectif de stage non renseigne"
      const status = stage?.statut_stage || stagiaire.statut_stage || "EN_ATTENTE"
      const startDate = stagiaire.date_debut_stage || stage?.date_debut
      const endDate = stagiaire.date_fin_stage || stage?.date_fin
      const progressPct = progress?.progress_pct ?? 0
      const tasksDone = progress?.tasks_done ?? 0
      const tasksTotal = progress?.tasks_total ?? 0
      const evaluationsCount = progress?.evaluations_count ?? 0
      const overdue = progress?.retard ?? 0

      return {
        stagiaire,
        fullName,
        subject,
        status,
        startDate,
        endDate,
        progressPct,
        tasksDone,
        tasksTotal,
        evaluationsCount,
        overdue,
      }
    })
  }, [stagiaires, stageByStagiaire, progressByStagiaire])

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Mes Stagiaires"
          subtitle={"Detail complet de vos stagiaires en cours"}
          actions={(
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadStagiaires({ silent: true })}
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
            Chargement des stagiaires...
          </div>
        ) : cardItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Aucun stagiaire associe pour le moment.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {cardItems.map((item) => (
              <Card key={item.stagiaire.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
                    <Link
                      to={`/dashboard/encadrant/stagiaires/${item.stagiaire.id}`}
                      className="group flex flex-1 flex-col gap-4 lg:flex-row"
                      aria-label={`Ouvrir la fiche de ${item.fullName}`}
                    >
                      <div className="flex items-start gap-3 lg:w-72 shrink-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground font-bold text-sm shrink-0">
                          {getInitials(item.stagiaire.prenom, item.stagiaire.nom)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground text-sm group-hover:text-indigo-700 transition-colors">
                              {item.fullName}
                            </p>
                            <StatusTag status={item.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.stagiaire.email}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {item.stagiaire.etablissement}
                            </span>
                            <Badge variant="secondary" className="text-xs py-0">
                              {enumToLabel(item.stagiaire.type_stage)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.subject}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(item.startDate)} - {formatDate(item.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <Progress value={item.progressPct} className="h-2 flex-1" />
                          <span className="text-xs font-bold text-foreground w-10 text-right">{item.progressPct}%</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            {item.tasksDone}/{item.tasksTotal} taches
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {item.evaluationsCount} evaluation(s)
                          </span>
                          {item.overdue > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Clock className="h-3 w-3" />
                              {item.overdue} en retard
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-start gap-2 lg:w-32 lg:flex-col shrink-0">
                      <Button asChild variant="outline" size="sm" className="flex-1 lg:w-full text-xs h-8 gap-1">
                        <Link to="/dashboard/encadrant/messages">
                          <MessageSquare className="h-3 w-3" />
                          Message
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="flex-1 lg:w-full text-xs h-8 gap-1">
                        <Link to={`/dashboard/encadrant/taches?stagiaire=${item.stagiaire.id}`}>
                          <ClipboardList className="h-3 w-3" />
                          Taches
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="flex-1 lg:w-full text-xs h-8 gap-1">
                        <Link to="/dashboard/encadrant/evaluations">
                          <Star className="h-3 w-3" />
                          Evaluer
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
