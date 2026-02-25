import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Calendar,
  ChevronRight,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Users,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useAdminSidebar } from "@/hooks/use-admin-sidebar"

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

interface EncadreurRead {
  id: number
  nom: string
  prenom: string
  departement: string | null
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

function getInitials(prenom: string | null | undefined, nom: string | null | undefined): string {
  const p = (prenom || "").trim()[0] || ""
  const n = (nom || "").trim()[0] || ""
  return `${p}${n}`.toUpperCase() || "ST"
}

function StatusBadge({ status }: { status: string }) {
  const key = (status || "").toUpperCase()
  const meta =
    key === "TERMINE"
      ? { label: "Termine", className: "bg-slate-100 text-slate-700 border-slate-200" }
      : key === "EN_ATTENTE"
        ? { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" }
        : key === "ANNULE"
          ? { label: "Annule", className: "bg-red-50 text-red-700 border-red-200" }
          : { label: "En cours", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function AdminStagiairesPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useAdminSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [stagiaires, setStagiaires] = useState<StagiaireRead[]>([])
  const [encadreurById, setEncadreurById] = useState<Record<number, EncadreurRead>>({})
  const [progressById, setProgressById] = useState<Record<number, StagiaireProgressResponse>>({})

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
        const [stagiairesResult, encadreursResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<StagiaireRead[]>("/stagiaires/?limit=300"),
          requestAuthJson<EncadreurRead[]>("/encadreur/"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [stagiairesResult, encadreursResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (stagiairesResult.status === "rejected") {
          throw stagiairesResult.reason
        }

        const warnings: string[] = []
        const nextStagiaires = [...stagiairesResult.value].sort((a, b) =>
          fullName(a.prenom, a.nom).localeCompare(fullName(b.prenom, b.nom)),
        )

        const nextEncadreurById: Record<number, EncadreurRead> = {}
        if (encadreursResult.status === "fulfilled") {
          for (const encadreur of encadreursResult.value) {
            nextEncadreurById[encadreur.id] = encadreur
          }
        } else {
          warnings.push(`Encadreurs: ${asErrorMessage(encadreursResult.reason, "indisponibles")}`)
        }

        if (sidebarResult.status === "rejected") {
          warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        const progressResults = await Promise.allSettled(
          nextStagiaires.map((stagiaire) =>
            requestAuthJson<StagiaireProgressResponse>(`/stagiaires/${stagiaire.id}/progress`),
          ),
        )

        const nextProgressById: Record<number, StagiaireProgressResponse> = {}
        progressResults.forEach((result, index) => {
          const stagiaire = nextStagiaires[index]
          if (result.status === "fulfilled") {
            nextProgressById[stagiaire.id] = result.value
            return
          }
          if (isApiErrorStatus(result.reason, 403) || isApiErrorStatus(result.reason, 404)) {
            return
          }
          warnings.push(
            `Progression ${fullName(stagiaire.prenom, stagiaire.nom)}: ${asErrorMessage(result.reason, "indisponible")}`,
          )
        })

        setStagiaires(nextStagiaires)
        setEncadreurById(nextEncadreurById)
        setProgressById(nextProgressById)
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
    [navigate, refreshSidebar],
  )

  useEffect(() => {
    void loadStagiaires()
  }, [loadStagiaires])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return stagiaires
    }

    return stagiaires.filter((stagiaire) => {
      const encadreur = stagiaire.encadreur_id ? encadreurById[stagiaire.encadreur_id] : null
      const searchable = [
        fullName(stagiaire.prenom, stagiaire.nom),
        stagiaire.email,
        stagiaire.matricule,
        stagiaire.etablissement,
        stagiaire.type_stage,
        encadreur ? fullName(encadreur.prenom, encadreur.nom) : "",
      ]
        .join(" ")
        .toLowerCase()
      return searchable.includes(query)
    })
  }, [encadreurById, searchQuery, stagiaires])

  const summary = useMemo(() => {
    const total = stagiaires.length
    const active = stagiaires.filter((item) => (item.statut_stage || "").toUpperCase() === "EN_COURS").length
    const finished = stagiaires.filter((item) => (item.statut_stage || "").toUpperCase() === "TERMINE").length
    const averageProgress = stagiaires.length
      ? Math.round(
          stagiaires.reduce((sum, item) => sum + (progressById[item.id]?.progress_pct || 0), 0) / stagiaires.length,
        )
      : 0
    return { total, active, finished, averageProgress }
  }, [progressById, stagiaires])

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Stagiaires"
          subtitle="Liste des stagiaires avec progression reelle depuis le backend"
          actions={(
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => void loadStagiaires({ silent: true })}
              disabled={isLoading || isRefreshing}
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
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {sidebarWarning}
          </div>
        )}

        {dataWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {dataWarning}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Total</p>
              <p className="mt-0.5 text-xl font-bold text-foreground">{summary.total}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">En cours</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-700">{summary.active}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Termines</p>
              <p className="mt-0.5 text-xl font-bold text-slate-700">{summary.finished}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Progression moyenne</p>
              <p className="mt-0.5 text-xl font-bold text-indigo-700">{summary.averageProgress}%</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un stagiaire..."
            className="h-9 max-w-sm pl-9 text-sm"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        {isLoading ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des stagiaires...
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Aucun stagiaire ne correspond a votre recherche.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((stagiaire) => {
              const encadreur = stagiaire.encadreur_id ? encadreurById[stagiaire.encadreur_id] : null
              const progress = progressById[stagiaire.id]
              const progressPct = progress?.progress_pct || 0
              const tasksDone = progress?.tasks_done || 0
              const tasksTotal = progress?.tasks_total || 0

              return (
                <Card key={stagiaire.id} className="shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <Link
                        to={`/dashboard/admin/stagiaires/${stagiaire.id}`}
                        className="group flex min-w-0 flex-1 items-start gap-3"
                        aria-label={`Ouvrir les details de ${fullName(stagiaire.prenom, stagiaire.nom)}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
                          {getInitials(stagiaire.prenom, stagiaire.nom)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground group-hover:text-indigo-700">
                              {fullName(stagiaire.prenom, stagiaire.nom)}
                            </p>
                            <StatusBadge status={stagiaire.statut_stage} />
                            <Badge variant="secondary" className="text-xs">{enumToLabel(stagiaire.type_stage)}</Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{stagiaire.email}</p>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {encadreur ? fullName(encadreur.prenom, encadreur.nom) : "Non assigne"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(stagiaire.date_debut_stage)}
                            </span>
                            <span>{tasksDone}/{tasksTotal} taches</span>
                            <span className="font-semibold text-foreground">{progressPct}%</span>
                          </div>

                          <div className="mt-2">
                            <Progress value={progressPct} className="h-1.5" />
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
                          <a href={`mailto:${stagiaire.email}`}>
                            <Mail className="h-3 w-3" />
                            Contacter
                          </a>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                          <Link to={`/dashboard/admin/stagiaires/${stagiaire.id}`}>
                            Details
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
