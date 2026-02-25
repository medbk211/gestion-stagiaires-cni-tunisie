import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  ChevronRight,
  Clock,
  Loader2,
  Target,
  Users,
} from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
}

interface EncadreurRead {
  id: number
  nom: string
  prenom: string
  email: string
  departement: string | null
}

interface ProjectMemberRow {
  stageId: number
  stagiaireId: number
  fullName: string
  email: string
  statutStage: string
  dateDebut: string | null
  dateFin: string | null
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

function StageStatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status || "").toUpperCase()
  const meta =
    key === "EN_COURS"
      ? { label: "En cours", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : key === "TERMINE"
        ? { label: "Termine", className: "bg-slate-100 text-slate-700 border-slate-200" }
        : key === "ANNULE"
          ? { label: "Annule", className: "bg-red-50 text-red-700 border-red-200" }
          : { label: enumToLabel(status), className: "bg-amber-50 text-amber-700 border-amber-200" }

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function AdminProjectDetailsPage() {
  const navigate = useNavigate()
  const { projetId } = useParams()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useAdminSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [project, setProject] = useState<ProjetRead | null>(null)
  const [encadreur, setEncadreur] = useState<EncadreurRead | null>(null)
  const [projectStages, setProjectStages] = useState<StageRead[]>([])
  const [memberRows, setMemberRows] = useState<ProjectMemberRow[]>([])

  const numericId = useMemo(() => {
    if (!projetId) {
      return null
    }
    const parsed = Number(projetId)
    return Number.isFinite(parsed) ? parsed : null
  }, [projetId])

  const loadDetails = useCallback(async () => {
    if (!numericId) {
      setPageError("Projet introuvable.")
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
      const [projectResult, stagesResult, stagiairesResult, sidebarResult] = await Promise.allSettled([
        requestAuthJson<ProjetRead>(`/Project/projets/${numericId}`),
        requestAuthJson<StageRead[]>("/Stages/?limit=1000"),
        requestAuthJson<StagiaireRead[]>("/stagiaires/?limit=1000"),
        refreshSidebar({ silent: true }),
      ] as const)

      if (
        [projectResult, stagesResult, stagiairesResult, sidebarResult].some(
          (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
        )
      ) {
        throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
      }

      if (projectResult.status === "rejected") {
        throw projectResult.reason
      }

      const warnings: string[] = []
      const nextProject = projectResult.value

      const allStages = stagesResult.status === "fulfilled" ? stagesResult.value : []
      if (stagesResult.status === "rejected") {
        warnings.push(`Stages: ${asErrorMessage(stagesResult.reason, "indisponibles")}`)
      }
      const relatedStages = allStages.filter((stage) => stage.projet_id === nextProject.id)

      const stagiaireById: Record<number, StagiaireRead> = {}
      if (stagiairesResult.status === "fulfilled") {
        for (const stagiaire of stagiairesResult.value) {
          stagiaireById[stagiaire.id] = stagiaire
        }
      } else {
        warnings.push(`Stagiaires: ${asErrorMessage(stagiairesResult.reason, "indisponibles")}`)
      }

      if (sidebarResult.status === "rejected") {
        warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
      }

      const nextMemberRows = relatedStages
        .map((stage) => {
          const stagiaire = stagiaireById[stage.stagiaire_id]
          return {
            stageId: stage.id,
            stagiaireId: stage.stagiaire_id,
            fullName: stagiaire ? fullName(stagiaire.prenom, stagiaire.nom) : `Stagiaire #${stage.stagiaire_id}`,
            email: stagiaire?.email || "-",
            statutStage: stage.statut_stage,
            dateDebut: stage.date_debut || null,
            dateFin: stage.date_fin || null,
          }
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName))

      let nextEncadreur: EncadreurRead | null = null
      if (nextProject.encadreur_id) {
        try {
          nextEncadreur = await requestAuthJson<EncadreurRead>(`/encadreur/${nextProject.encadreur_id}`)
        } catch (error) {
          if (isApiErrorStatus(error, 401)) {
            throw error
          }
          warnings.push(`Encadreur: ${asErrorMessage(error, "indisponible")}`)
        }
      }

      setProject(nextProject)
      setEncadreur(nextEncadreur)
      setProjectStages(relatedStages)
      setMemberRows(nextMemberRows)
      setDataWarning(warnings[0] || "")
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        clearAuthSession()
        navigate("/connexion", { replace: true })
        return
      }
      if (isApiErrorStatus(error, 404)) {
        setPageError("Projet introuvable.")
      } else {
        setPageError(asErrorMessage(error, "Chargement de la fiche projet impossible pour le moment."))
      }
    } finally {
      setIsLoading(false)
    }
  }, [navigate, numericId, refreshSidebar])

  useEffect(() => {
    void loadDetails()
  }, [loadDetails])

  const projectTitle = project ? `${project.code_projet} - ${project.intitule}` : "Projet"

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          kicker="Fiche projet"
          title={projectTitle}
          subtitle={project ? `${enumToLabel(project.departement)} - ${enumToLabel(project.type_stage)}` : "Details du projet"}
          actions={(
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/admin/projets")}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour
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

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de la fiche projet...
          </div>
        ) : !project ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Aucun detail disponible pour ce projet.
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Informations projet</CardTitle>
                  <CardDescription>Details complets du projet selectionne.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={project.status} />
                    <Badge variant="secondary">{enumToLabel(project.departement)}</Badge>
                    <Badge variant="outline">{enumToLabel(project.type_stage)}</Badge>
                    <Badge variant="outline">Niveau: {enumToLabel(project.niveau_requis)}</Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</p>
                      <p className="mt-1 font-semibold text-foreground">{project.code_projet}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Duree et charge</p>
                      <p className="mt-1 font-semibold text-foreground">{project.duree_semaines} semaines</p>
                      <p className="mt-1 text-xs text-muted-foreground">{project.charge_hebdo} h / semaine</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Complexite</p>
                      <p className="mt-1 font-semibold text-foreground">{project.complexite}/5</p>
                      <p className="mt-1 text-xs text-muted-foreground">Priorite: {project.priorite}/5</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capacite</p>
                      <p className="mt-1 font-semibold text-foreground">{project.nombre_max_stagiaires} max</p>
                      <p className="mt-1 text-xs text-muted-foreground">{memberRows.length} en stage</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Creation</p>
                      <p className="mt-1 font-semibold text-foreground">{formatDate(project.created_at)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Derniere maj</p>
                      <p className="mt-1 font-semibold text-foreground">{formatDate(project.updated_at)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5" />
                      Description
                    </div>
                    <p className="mt-2 text-sm text-foreground">
                      {project.description || "Description indisponible."}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Target className="h-3.5 w-3.5" />
                      Objectifs
                    </div>
                    <p className="mt-2 text-sm text-foreground">
                      {project.objectifs || "Objectifs non renseignes."}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Livrables</p>
                    <p className="mt-2 text-sm text-foreground">
                      {project.livrables || "Livrables non renseignes."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Stagiaires assignes</CardTitle>
                  <CardDescription>{memberRows.length} stagiaire(s) rattache(s) a ce projet.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {memberRows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                      Aucun stagiaire assigne pour le moment.
                    </div>
                  ) : (
                    memberRows.map((member) => (
                      <Link
                        key={member.stageId}
                        to={`/dashboard/admin/stagiaires/${member.stagiaireId}`}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 transition-colors hover:bg-secondary/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{member.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDate(member.dateDebut)} - {formatDate(member.dateFin)}
                          </p>
                        </div>
                        <div className="ml-3 flex items-center gap-2">
                          <StageStatusBadge status={member.statutStage} />
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Encadreur</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="font-semibold text-foreground">
                    {encadreur ? fullName(encadreur.prenom, encadreur.nom) : "Non assigne"}
                  </p>
                  <p className="text-muted-foreground">{encadreur?.email || "-"}</p>
                  <p className="text-muted-foreground">Departement: {enumToLabel(encadreur?.departement)}</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Competences et tags</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Competences</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {project.competences?.length ? (
                        project.competences.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-[11px]">{skill}</Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">Aucune competence specifiee.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {project.tags?.length ? (
                        project.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[11px]">{tag}</Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">Aucun tag specifie.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Indicateurs rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Stagiaires actifs: {memberRows.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Stages relies: {projectStages.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Charge hebdo: {project.charge_hebdo} h
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
