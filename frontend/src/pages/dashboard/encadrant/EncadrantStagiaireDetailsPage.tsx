import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  Loader2,
  MessageSquare,
  Star,
  UserRound,
} from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  complexite: number
  priorite: number
  status: string
  encadreur_id?: number | null
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

function formatDateTime(value: string | null | undefined): string {
  const parsed = parseDate(value)
  return parsed ? DATE_TIME_FORMATTER.format(parsed) : "-"
}

function getDaysRemaining(value: string | null | undefined): number | null {
  const parsed = parseDate(value)
  if (!parsed) {
    return null
  }
  const diffMs = parsed.getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
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

export default function EncadrantStagiaireDetailsPage() {
  const navigate = useNavigate()
  const { stagiaireId } = useParams()
  const { navItems, userName, userRole } = useEncadrantSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [stagiaire, setStagiaire] = useState<StagiaireRead | null>(null)
  const [progress, setProgress] = useState<StagiaireProgressResponse | null>(null)
  const [stage, setStage] = useState<StageRead | null>(null)
  const [project, setProject] = useState<ProjetStageRead | null>(null)

  const numericId = useMemo(() => {
    if (!stagiaireId) {
      return null
    }
    const parsed = Number(stagiaireId)
    return Number.isFinite(parsed) ? parsed : null
  }, [stagiaireId])

  const loadDetails = useCallback(async () => {
    if (!numericId) {
      setPageError("Stagiaire introuvable.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setPageError("")
    setDataWarning("")

    const accessToken = localStorage.getItem("cni_access_token")
    if (!accessToken) {
      setIsLoading(false)
      navigate("/connexion", { replace: true })
      return
    }

    try {
      const [stagiaireResult, progressResult, stagesResult] = await Promise.allSettled([
        requestAuthJson<StagiaireRead>(`/stagiaires/${numericId}`),
        requestAuthJson<StagiaireProgressResponse>(`/stagiaires/${numericId}/progress`),
        requestAuthJson<StageRead[]>("/Stages/my-interns"),
      ] as const)

      if (
        [stagiaireResult, progressResult, stagesResult].some(
          (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
        )
      ) {
        throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
      }

      if (stagiaireResult.status === "rejected") {
        throw stagiaireResult.reason
      }

      const warnings: string[] = []
      const nextStagiaire = stagiaireResult.value

      const nextProgress = progressResult.status === "fulfilled" ? progressResult.value : null
      if (progressResult.status === "rejected" && !isApiErrorStatus(progressResult.reason, 404)) {
        warnings.push(`Progression: ${asErrorMessage(progressResult.reason, "indisponible")}`)
      }

      const stages = stagesResult.status === "fulfilled" ? stagesResult.value : []
      if (stagesResult.status === "rejected") {
        warnings.push(`Stages: ${asErrorMessage(stagesResult.reason, "indisponibles")}`)
      }

      let selectedStage: StageRead | null = null
      for (const candidate of stages) {
        if (candidate.stagiaire_id !== numericId) {
          continue
        }
        selectedStage = pickPreferredStage(selectedStage || undefined, candidate)
      }

      let nextProject: ProjetStageRead | null = null
      if (selectedStage) {
        try {
          nextProject = await requestAuthJson<ProjetStageRead>(`/Project/projets/by-stage/${selectedStage.id}`)
        } catch (error) {
          if (isApiErrorStatus(error, 401)) {
            throw error
          }
          if (!isApiErrorStatus(error, 404)) {
            warnings.push(`Projet: ${asErrorMessage(error, "indisponible")}`)
          }
        }
      }

      setStagiaire(nextStagiaire)
      setProgress(nextProgress)
      setStage(selectedStage)
      setProject(nextProject)
      setDataWarning(warnings[0] || "")
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        clearAuthSession()
        navigate("/connexion", { replace: true })
        return
      }
      if (isApiErrorStatus(error, 404)) {
        setPageError("Stagiaire introuvable.")
      } else {
        setPageError(asErrorMessage(error, "Chargement de la fiche impossible pour le moment."))
      }
    } finally {
      setIsLoading(false)
    }
  }, [navigate, numericId])

  useEffect(() => {
    void loadDetails()
  }, [loadDetails])

  const fullName = useMemo(() => {
    return `${stagiaire?.prenom || ""} ${stagiaire?.nom || ""}`.trim() || "Stagiaire"
  }, [stagiaire?.nom, stagiaire?.prenom])

  const stageStart = stagiaire?.date_debut_stage || stage?.date_debut
  const stageEnd = stagiaire?.date_fin_stage || stage?.date_fin
  const daysRemaining = useMemo(() => getDaysRemaining(stageEnd), [stageEnd])
  const status = stage?.statut_stage || stagiaire?.statut_stage

  const progressPct = progress?.progress_pct ?? 0
  const tasksDone = progress?.tasks_done ?? 0
  const tasksTotal = progress?.tasks_total ?? 0
  const tasksInProgress = progress?.tasks_in_progress ?? 0
  const tasksTodo = progress?.tasks_todo ?? 0
  const tasksOverdue = progress?.retard ?? 0
  const evaluationsCount = progress?.evaluations_count ?? 0
  const moyenneNote = progress?.moyenne_note
  const moyenneLabel = moyenneNote !== null && moyenneNote !== undefined ? moyenneNote.toFixed(2) : "-"

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          kicker="Fiche stagiaire"
          title={fullName}
          subtitle={stagiaire?.email || "Detail complet du stagiaire"}
          actions={(
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/encadrant/stagiaires")}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/encadrant/messages">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Message
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to={`/dashboard/encadrant/taches?stagiaire=${numericId}`}>
                  <ClipboardList className="h-3.5 w-3.5" />
                  Taches
                </Link>
              </Button>
            </div>
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
            Chargement de la fiche stagiaire...
          </div>
        ) : !stagiaire ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Aucun detail disponible pour ce stagiaire.
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Stage en cours</CardTitle>
                  <CardDescription>Informations principales sur le stage et le sujet.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {!stage && !stageStart ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Aucun stage n est associe a ce stagiaire pour le moment.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusTag status={status} />
                        <Badge variant="secondary">{enumToLabel(stagiaire.type_stage)}</Badge>
                        {stagiaire.niveau_etude && (
                          <Badge variant="outline">{enumToLabel(stagiaire.niveau_etude)}</Badge>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Periode</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatDate(stageStart)} - {formatDate(stageEnd)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {daysRemaining !== null
                              ? daysRemaining >= 0
                                ? `${daysRemaining} jour(s) restants`
                                : `Stage depasse de ${Math.abs(daysRemaining)} jour(s)`
                              : "Date de fin indisponible"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{enumToLabel(status)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Encadreur #{stagiaire.encadreur_id ?? "-"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5" />
                          Objectif principal
                        </div>
                        <p className="mt-2 text-sm text-foreground">
                          {stage?.texte_objectif || "Objectif non defini pour ce stage."}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Projet associe</CardTitle>
                  <CardDescription>Informations du projet de stage rattache.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {!project ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Aucun projet associe a ce stage pour le moment.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{project.intitule}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{project.description}</p>
                        </div>
                        <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                          {enumToLabel(project.status)}
                        </Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Code projet</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{project.code_projet}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {enumToLabel(project.departement)} · {enumToLabel(project.type_stage)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Charge</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{project.duree_semaines} semaines</p>
                          <p className="mt-1 text-xs text-muted-foreground">{project.charge_hebdo} h / semaine</p>
                        </div>
                      </div>

                      {project.competences?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Competences
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {project.competences.slice(0, 8).map((skill) => (
                              <Badge key={skill} variant="outline" className="text-[11px]">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Profil stagiaire</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-start gap-2">
                    <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{fullName}</p>
                      <p className="text-xs text-muted-foreground">{stagiaire.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <ClipboardList className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{stagiaire.matricule}</p>
                      <p className="text-xs text-muted-foreground">Matricule</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <GraduationCap className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">{stagiaire.etablissement}</p>
                      <p className="text-xs text-muted-foreground">
                        {stagiaire.niveau_etude ? enumToLabel(stagiaire.niveau_etude) : "Niveau non renseigne"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">
                        Note finale: {stagiaire.note_finale ?? "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Validation: {stagiaire.date_validation ? formatDateTime(stagiaire.date_validation) : "-"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Progression</CardTitle>
                  <CardDescription>Etat des taches et evaluations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avancement global</p>
                    <span className="text-sm font-semibold text-foreground">{progressPct}%</span>
                  </div>
                  <Progress value={progressPct} className="h-2.5" />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                      <p className="text-xs font-semibold text-emerald-700">{tasksDone}/{tasksTotal}</p>
                      <p className="text-[11px] text-emerald-700/80">Taches terminees</p>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-center">
                      <p className="text-xs font-semibold text-indigo-700">{tasksInProgress}</p>
                      <p className="text-[11px] text-indigo-700/80">En cours</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                      <p className="text-xs font-semibold text-slate-700">{tasksTodo}</p>
                      <p className="text-[11px] text-slate-700/80">A faire</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
                      <p className="text-xs font-semibold text-amber-700">{tasksOverdue}</p>
                      <p className="text-[11px] text-amber-700/80">En retard</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">{evaluationsCount} evaluation(s)</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" />
                      Moyenne: {moyenneLabel}
                    </div>
                    {tasksOverdue > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-amber-700">
                        <Clock className="h-3 w-3" />
                        {tasksOverdue} tache(s) en retard
                      </div>
                    )}
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
