import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Briefcase,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAdminSidebar } from "@/hooks/use-admin-sidebar"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"

interface ProjetRead {
  id: number
  code_projet: string
  intitule: string
  departement: string
  type_stage: string
  description: string
  objectifs: string
  livrables: string
  fiche_pdf_path?: string | null
  duree_semaines: number
  charge_hebdo: number
  niveau_requis: string
  competences: string[]
  tags: string[]
  complexite: number
  priorite: number
  status: string
  encadreur_id?: number | null
  nombre_max_stagiaires: number
  created_at: string
  updated_at: string
}

interface StageRead {
  id: number
  statut_stage: string
  stagiaire_id: number
  encadreur_id: number
  projet_id: number | null
}

interface EncadreurRead {
  id: number
  nom: string
  prenom: string
  email: string
  departement: string | null
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

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}

function fullName(prenom: string | null | undefined, nom: string | null | undefined): string {
  return `${prenom || ""} ${nom || ""}`.trim()
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status || "").toUpperCase()
  const meta =
    key.includes("AFFECT")
      ? { label: "Affecte", className: "bg-indigo-50 text-indigo-700 border-indigo-200" }
      : key.includes("EN_COURS")
        ? { label: "En cours", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
        : key.includes("TERMINE") || key.includes("CLOTURE")
          ? { label: "Termine", className: "bg-slate-100 text-slate-700 border-slate-200" }
          : key.includes("ANNULE")
            ? { label: "Annule", className: "bg-red-50 text-red-700 border-red-200" }
            : { label: enumToLabel(status), className: "bg-amber-50 text-amber-700 border-amber-200" }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function AdminProjectsPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useAdminSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [projects, setProjects] = useState<ProjetRead[]>([])
  const [encadreurById, setEncadreurById] = useState<Record<number, EncadreurRead>>({})
  const [stagiairesCountByProject, setStagiairesCountByProject] = useState<Record<number, number>>({})

  const loadProjects = useCallback(
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
        const [projectsResult, encadreursResult, stagesResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<ProjetRead[]>("/Project/projets?limit=500"),
          requestAuthJson<EncadreurRead[]>("/encadreur/"),
          requestAuthJson<StageRead[]>("/Stages/?limit=1000"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [projectsResult, encadreursResult, stagesResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (projectsResult.status === "rejected") {
          throw projectsResult.reason
        }

        const warnings: string[] = []
        const nextProjects = [...projectsResult.value].sort((a, b) => {
          const timeA = parseDate(a.updated_at)?.getTime() || 0
          const timeB = parseDate(b.updated_at)?.getTime() || 0
          if (timeB !== timeA) {
            return timeB - timeA
          }
          return `${a.code_projet} ${a.intitule}`.localeCompare(`${b.code_projet} ${b.intitule}`)
        })

        const nextEncadreurById: Record<number, EncadreurRead> = {}
        if (encadreursResult.status === "fulfilled") {
          for (const encadreur of encadreursResult.value) {
            nextEncadreurById[encadreur.id] = encadreur
          }
        } else {
          warnings.push(`Encadreurs: ${asErrorMessage(encadreursResult.reason, "indisponibles")}`)
        }

        const nextStagiairesCountByProject: Record<number, number> = {}
        if (stagesResult.status === "fulfilled") {
          for (const stage of stagesResult.value) {
            if (!stage.projet_id) {
              continue
            }
            nextStagiairesCountByProject[stage.projet_id] = (nextStagiairesCountByProject[stage.projet_id] || 0) + 1
          }
        } else {
          warnings.push(`Affectations stage: ${asErrorMessage(stagesResult.reason, "indisponibles")}`)
        }

        if (sidebarResult.status === "rejected") {
          warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        setProjects(nextProjects)
        setEncadreurById(nextEncadreurById)
        setStagiairesCountByProject(nextStagiairesCountByProject)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement des projets impossible pour le moment."))
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
    void loadProjects()
  }, [loadProjects])

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return projects
    }
    return projects.filter((project) => {
      const searchable = [
        project.code_projet,
        project.intitule,
        project.description || "",
        project.departement,
        project.type_stage,
        project.niveau_requis,
        project.status,
      ]
        .join(" ")
        .toLowerCase()
      return searchable.includes(query)
    })
  }, [projects, searchQuery])

  const summary = useMemo(() => {
    const total = projects.length
    const affectes = projects.filter((project) => (project.status || "").toUpperCase().includes("AFFECT")).length
    const avecStagiaires = projects.filter((project) => (stagiairesCountByProject[project.id] || 0) > 0).length
    const sansEncadreur = projects.filter((project) => !project.encadreur_id).length
    return { total, affectes, avecStagiaires, sansEncadreur }
  }, [projects, stagiairesCountByProject])

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Projets"
          subtitle="Catalogue des projets avec acces rapide aux fiches detaillees"
          actions={(
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => void loadProjects({ silent: true })}
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
              <p className="text-xs font-medium text-muted-foreground">Affectes</p>
              <p className="mt-0.5 text-xl font-bold text-indigo-700">{summary.affectes}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Avec stagiaires</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-700">{summary.avecStagiaires}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Sans encadreur</p>
              <p className="mt-0.5 text-xl font-bold text-amber-700">{summary.sansEncadreur}</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projet..."
            className="h-9 max-w-sm pl-9 text-sm"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        {isLoading ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des projets...
            </CardContent>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Aucun projet ne correspond a votre recherche.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProjects.map((project) => {
              const encadreur = project.encadreur_id ? encadreurById[project.encadreur_id] : null
              const stagiairesCount = stagiairesCountByProject[project.id] || 0

              return (
                <Card key={project.id} className="shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <Link
                        to={`/dashboard/admin/projets/${project.id}`}
                        className="group flex min-w-0 flex-1 items-start gap-3"
                        aria-label={`Ouvrir les details du projet ${project.code_projet}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                          <Briefcase className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground group-hover:text-indigo-700">
                              {project.code_projet} - {project.intitule}
                            </p>
                            <StatusBadge status={project.status} />
                            <Badge variant="secondary" className="text-xs">{enumToLabel(project.departement)}</Badge>
                            <Badge variant="outline" className="text-xs">{enumToLabel(project.type_stage)}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {project.description || "Description indisponible."}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <UserRound className="h-3 w-3" />
                              {encadreur ? fullName(encadreur.prenom, encadreur.nom) : "Sans encadreur"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {stagiairesCount} stagiaire(s)
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {project.duree_semaines} semaines
                            </span>
                            <span>Niveau: {enumToLabel(project.niveau_requis)}</span>
                            <span>Maj: {formatDate(project.updated_at)}</span>
                          </div>
                        </div>
                      </Link>

                      <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                        <Link to={`/dashboard/admin/projets/${project.id}`}>
                          Details
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
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
