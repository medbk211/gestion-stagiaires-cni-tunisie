import { useCallback, useEffect, useMemo, useState } from "react"
import { Calendar, ClipboardList, Loader2, RefreshCw } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useEncadrantSidebar } from "@/hooks/use-encadrant-sidebar"

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

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
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

export default function EncadrantEvaluationsPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole } = useEncadrantSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [evaluations, setEvaluations] = useState<EvaluationRead[]>([])
  const [stagiaires, setStagiaires] = useState<StagiaireRead[]>([])

  const loadEvaluations = useCallback(
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
        const [evaluationsResult, stagiairesResult] = await Promise.allSettled([
          requestAuthJson<EvaluationRead[]>("/evaluations/my"),
          requestAuthJson<StagiaireRead[]>("/encadreur/me/stagiaires"),
        ] as const)

        if (
          [evaluationsResult, stagiairesResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (evaluationsResult.status === "rejected") {
          throw evaluationsResult.reason
        }

        const warnings: string[] = []
        const nextEvaluations = evaluationsResult.value || []
        const nextStagiaires = stagiairesResult.status === "fulfilled" ? stagiairesResult.value : []
        if (stagiairesResult.status === "rejected") {
          warnings.push(`Stagiaires: ${asErrorMessage(stagiairesResult.reason, "indisponibles")}`)
        }

        setEvaluations(nextEvaluations)
        setStagiaires(nextStagiaires)
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
    [navigate],
  )

  useEffect(() => {
    void loadEvaluations()
  }, [loadEvaluations])

  const stagiaireById = useMemo(() => {
    return stagiaires.reduce<Record<number, StagiaireRead>>((acc, stagiaire) => {
      acc[stagiaire.id] = stagiaire
      return acc
    }, {})
  }, [stagiaires])

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
        const fullName = stagiaire
          ? `${stagiaire.prenom} ${stagiaire.nom}`.trim()
          : `Stagiaire #${evaluation.stagiaire_id}`
        return {
          evaluation,
          stagiaire,
          fullName,
          stageType: stagiaire ? enumToLabel(stagiaire.type_stage) : "-",
          progressPct: Math.min(100, Math.max(0, Math.round((evaluation.note / 20) * 100))),
          dateLabel: formatDate(evaluation.created_at),
        }
      })
  }, [evaluations, stagiaireById])

  const stats = useMemo(() => {
    const total = evaluations.length
    const evaluatedIds = new Set(evaluations.map((ev) => ev.stagiaire_id))
    const pending = Math.max(0, stagiaires.filter((s) => !evaluatedIds.has(s.id)).length)
    const average = total > 0
      ? (evaluations.reduce((sum, ev) => sum + ev.note, 0) / total).toFixed(1)
      : "-"

    return { total, pending, average }
  }, [evaluations, stagiaires])

  return (
    <DashboardShell role="encadrant" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Evaluations"
          subtitle={"Gerer les evaluations de vos stagiaires"}
          actions={(
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadEvaluations({ silent: true })}
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

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">A faire</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{stats.pending}</p>
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
        ) : evaluationItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Aucune evaluation disponible pour le moment.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {evaluationItems.map(({ evaluation, stagiaire, fullName, stageType, progressPct, dateLabel }) => (
              <Card key={evaluation.id} className="shadow-sm">
                <CardContent className="py-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{fullName}</p>
                        {stagiaire && (
                          <Badge variant="secondary" className="text-xs py-0">
                            {stageType}
                          </Badge>
                        )}
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs py-0">
                          Completee
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {dateLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          Projet #{evaluation.projet_id}
                        </span>
                      </div>

                      {evaluation.commentaire && (
                        <p className="mt-3 text-sm text-foreground leading-relaxed">
                          {evaluation.commentaire}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:w-32 shrink-0">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{evaluation.note}</p>
                        <p className="text-xs text-muted-foreground">/20</p>
                      </div>
                      <Progress value={progressPct} className="h-2 w-24" />
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
