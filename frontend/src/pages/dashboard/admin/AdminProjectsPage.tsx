import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  Briefcase,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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

interface ProjetStageOptionsRead {
  competences_by_departement: Record<string, string[]>
  tags: string[]
}

interface ProjectCreateResponse {
  success: boolean
  message: string
  code_projet: string
  intitule: string
  fiche_pdf_uploaded: boolean
}

interface ProjectCreateFormState {
  intitule: string
  departement: string
  type_stage: string
  description: string
  objectifs: string
  livrables: string
  duree_semaines: string
  charge_hebdo: string
  niveau_requis: string
  competences: string[]
  tags: string[]
  complexite: string
  priorite: string
  nombre_max_stagiaires: string
  fiche_pdf: File | null
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

const DEPARTEMENT_OPTIONS = [
  "INFORMATIQUE",
  "RESSOURCES_HUMAINES",
  "FINANCES",
  "EXPLOITATION",
  "SUPPORT",
  "ADMINISTRATION",
] as const

const TYPE_STAGE_OPTIONS = ["PFE", "INITIATION", "PERFECTIONNEMENT"] as const
const NIVEAU_OPTIONS = ["LICENCE", "MASTER", "DOCTORAT"] as const
const RANK_OPTIONS = [1, 2, 3, 4, 5] as const

function buildInitialProjectForm(): ProjectCreateFormState {
  return {
    intitule: "",
    departement: "",
    type_stage: "",
    description: "",
    objectifs: "",
    livrables: "",
    duree_semaines: "4",
    charge_hebdo: "20",
    niveau_requis: "",
    competences: [],
    tags: [],
    complexite: "3",
    priorite: "3",
    nombre_max_stagiaires: "1",
    fiche_pdf: null,
  }
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

function toggleStringValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function addUniqueStringValue(values: string[], value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) {
    return values
  }
  if (values.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return values
  }
  return [...values, trimmed]
}

function buildUniqueStringValues(values: string[]): string[] {
  let result: string[] = []
  for (const value of values) {
    result = addUniqueStringValue(result, value)
  }
  return result
}

function fileLooksLikePdf(file: File): boolean {
  const filename = file.name.toLowerCase()
  const contentType = (file.type || "").toLowerCase()
  return filename.endsWith(".pdf") || contentType === "application/pdf"
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
  const [actionSuccess, setActionSuccess] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [projects, setProjects] = useState<ProjetRead[]>([])
  const [encadreurById, setEncadreurById] = useState<Record<number, EncadreurRead>>({})
  const [stagiairesCountByProject, setStagiairesCountByProject] = useState<Record<number, number>>({})
  const [projectOptions, setProjectOptions] = useState<ProjetStageOptionsRead | null>(null)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [createError, setCreateError] = useState("")
  const [customCompetence, setCustomCompetence] = useState("")
  const [customTag, setCustomTag] = useState("")
  const [fileInputKey, setFileInputKey] = useState(0)
  const [createForm, setCreateForm] = useState<ProjectCreateFormState>(buildInitialProjectForm())

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
        const [projectsResult, encadreursResult, stagesResult, optionsResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<ProjetRead[]>("/Project/projets?limit=500"),
          requestAuthJson<EncadreurRead[]>("/encadreur/"),
          requestAuthJson<StageRead[]>("/Stages/?limit=1000"),
          requestAuthJson<ProjetStageOptionsRead>("/Project/projets/options"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [projectsResult, encadreursResult, stagesResult, optionsResult, sidebarResult].some(
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

        if (optionsResult.status === "fulfilled") {
          setProjectOptions(optionsResult.value)
        } else {
          warnings.push(`Options projet: ${asErrorMessage(optionsResult.reason, "indisponibles")}`)
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

  const availableCompetenceOptions = useMemo(() => {
    if (!projectOptions) {
      return []
    }
    if (createForm.departement) {
      return buildUniqueStringValues(projectOptions.competences_by_departement[createForm.departement] || [])
    }
    return buildUniqueStringValues(Object.values(projectOptions.competences_by_departement).flat())
  }, [createForm.departement, projectOptions])

  const availableTagOptions = useMemo(
    () => buildUniqueStringValues(projectOptions?.tags || []),
    [projectOptions],
  )

  function resetCreateDialogState() {
    setCreateError("")
    setCustomCompetence("")
    setCustomTag("")
    setCreateForm(buildInitialProjectForm())
    setFileInputKey((prev) => prev + 1)
  }

  function openCreateDialog() {
    setActionSuccess("")
    resetCreateDialogState()
    setIsCreateDialogOpen(true)
  }

  function closeCreateDialog(options?: { force?: boolean }) {
    if (isCreatingProject && !options?.force) {
      return
    }
    setIsCreateDialogOpen(false)
    resetCreateDialogState()
  }

  function updateCreateFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    if (!file) {
      setCreateForm((prev) => ({ ...prev, fiche_pdf: null }))
      return
    }

    if (!fileLooksLikePdf(file)) {
      setCreateError("Veuillez choisir un PDF valide.")
      setCreateForm((prev) => ({ ...prev, fiche_pdf: null }))
      setFileInputKey((prev) => prev + 1)
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setCreateError("Le fichier PDF doit etre inferieur a 5 MB.")
      setCreateForm((prev) => ({ ...prev, fiche_pdf: null }))
      setFileInputKey((prev) => prev + 1)
      return
    }

    setCreateError("")
    setCreateForm((prev) => ({ ...prev, fiche_pdf: file }))
  }

  function removeCompetence(value: string) {
    setCreateForm((prev) => ({
      ...prev,
      competences: prev.competences.filter((item) => item !== value),
    }))
  }

  function removeTag(value: string) {
    setCreateForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((item) => item !== value),
    }))
  }

  function addCustomCompetence() {
    const nextValues = addUniqueStringValue(createForm.competences, customCompetence)
    if (nextValues === createForm.competences) {
      return
    }
    setCreateForm((prev) => ({ ...prev, competences: nextValues }))
    setCustomCompetence("")
  }

  function addCustomTag() {
    const nextValues = addUniqueStringValue(createForm.tags, customTag)
    if (nextValues === createForm.tags) {
      return
    }
    setCreateForm((prev) => ({ ...prev, tags: nextValues }))
    setCustomTag("")
  }

  async function handleCreateProject() {
    const intitule = createForm.intitule.trim()
    const description = createForm.description.trim()
    const objectifs = createForm.objectifs.trim()
    const livrables = createForm.livrables.trim()
    const dureeSemaines = Number(createForm.duree_semaines)
    const chargeHebdo = Number(createForm.charge_hebdo)
    const complexite = Number(createForm.complexite)
    const priorite = Number(createForm.priorite)
    const nombreMaxStagiaires = Number(createForm.nombre_max_stagiaires)

    if (!intitule || !description || !objectifs || !livrables) {
      setCreateError("Intitule, description, objectifs et livrables sont obligatoires.")
      return
    }

    if (!createForm.departement || !createForm.type_stage || !createForm.niveau_requis) {
      setCreateError("Selectionnez le departement, le type de stage et le niveau requis.")
      return
    }

    if (!Number.isFinite(dureeSemaines) || dureeSemaines <= 0) {
      setCreateError("La duree doit etre superieure a 0 semaine.")
      return
    }

    if (!Number.isFinite(chargeHebdo) || chargeHebdo < 1 || chargeHebdo > 40) {
      setCreateError("La charge hebdomadaire doit etre comprise entre 1 et 40 heures.")
      return
    }

    if (!Number.isFinite(complexite) || complexite < 1 || complexite > 5) {
      setCreateError("La complexite doit etre comprise entre 1 et 5.")
      return
    }

    if (!Number.isFinite(priorite) || priorite < 1 || priorite > 5) {
      setCreateError("La priorite doit etre comprise entre 1 et 5.")
      return
    }

    if (!Number.isFinite(nombreMaxStagiaires) || nombreMaxStagiaires <= 0) {
      setCreateError("Le nombre maximum de stagiaires doit etre superieur a 0.")
      return
    }

    if (createForm.fiche_pdf) {
      if (!fileLooksLikePdf(createForm.fiche_pdf)) {
        setCreateError("Le fichier joint doit etre un PDF valide.")
        return
      }
      if (createForm.fiche_pdf.size > MAX_FILE_SIZE_BYTES) {
        setCreateError("Le fichier PDF doit etre inferieur a 5 MB.")
        return
      }
    }

    setCreateError("")
    setActionSuccess("")
    setIsCreatingProject(true)

    try {
      const payload = new FormData()
      payload.append("intitule", intitule)
      payload.append("departement", createForm.departement)
      payload.append("type_stage", createForm.type_stage)
      payload.append("description", description)
      payload.append("objectifs", objectifs)
      payload.append("livrables", livrables)
      payload.append("duree_semaines", String(dureeSemaines))
      payload.append("charge_hebdo", String(chargeHebdo))
      payload.append("niveau_requis", createForm.niveau_requis)
      payload.append("complexite", String(complexite))
      payload.append("priorite", String(priorite))
      payload.append("nombre_max_stagiaires", String(nombreMaxStagiaires))

      for (const competence of createForm.competences) {
        payload.append("competences", competence)
      }

      for (const tag of createForm.tags) {
        payload.append("tags", tag)
      }

      if (createForm.fiche_pdf) {
        payload.append("fiche_pdf", createForm.fiche_pdf)
      }

      const created = await requestAuthJson<ProjectCreateResponse>("/Project/projets", {
        method: "POST",
        body: payload,
      })

      closeCreateDialog({ force: true })
      setActionSuccess(
        created.code_projet
          ? `Projet ${created.code_projet} ajoute avec succes.`
          : "Projet ajoute avec succes.",
      )
      await loadProjects({ silent: true })
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        clearAuthSession()
        navigate("/connexion", { replace: true })
        return
      }
      setCreateError(asErrorMessage(error, "Creation du projet impossible pour le moment."))
    } finally {
      setIsCreatingProject(false)
    }
  }

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Projets"
          subtitle="Catalogue des projets avec acces rapide aux fiches detaillees"
          actions={(
            <>
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
              <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={openCreateDialog}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter projet
              </Button>
            </>
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

        {actionSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {actionSuccess}
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

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet..."
              className="h-9 w-full pl-9 text-sm md:w-80"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="text-xs text-muted-foreground">
            {filteredProjects.length} projet(s) affiche(s) sur {projects.length}
          </div>
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
            <CardContent className="flex flex-col gap-3 py-6 text-sm text-muted-foreground">
              <p>
                {projects.length === 0
                  ? "Aucun projet n est encore disponible. Ajoutez votre premier projet depuis cette page."
                  : "Aucun projet ne correspond a votre recherche."}
              </p>
              {projects.length === 0 ? (
                <div>
                  <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter un projet
                  </Button>
                </div>
              ) : null}
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
                            {project.fiche_pdf_path ? <Badge variant="outline" className="text-xs">PDF</Badge> : null}
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

                          {project.tags?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {project.tags.slice(0, 4).map((tag) => (
                                <Badge key={`${project.id}-${tag}`} variant="outline" className="text-[11px]">
                                  {tag}
                                </Badge>
                              ))}
                              {project.tags.length > 4 ? (
                                <Badge variant="outline" className="text-[11px]">
                                  +{project.tags.length - 4}
                                </Badge>
                              ) : null}
                            </div>
                          ) : null}
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

        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeCreateDialog()
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Ajouter un projet</DialogTitle>
              <DialogDescription>
                Creez une nouvelle opportunite depuis la section Projets sans quitter le dashboard admin.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-1">
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createError}
                </div>
              )}

              {!projectOptions && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Les suggestions de competences et tags sont indisponibles pour le moment. Vous pouvez continuer avec une saisie manuelle.
                </div>
              )}

              <div className="grid gap-4 rounded-xl border border-border bg-slate-50/40 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Informations generales</p>
                  <p className="text-xs text-muted-foreground">Les champs principaux qui structurent la fiche projet.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="project-intitule">Intitule</Label>
                    <Input
                      id="project-intitule"
                      value={createForm.intitule}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, intitule: event.target.value }))}
                      placeholder="Ex: Plateforme de suivi des stages"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Departement</Label>
                    <Select
                      value={createForm.departement || undefined}
                      onValueChange={(value) => setCreateForm((prev) => ({ ...prev, departement: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selectionner un departement" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTEMENT_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {enumToLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Type de stage</Label>
                    <Select
                      value={createForm.type_stage || undefined}
                      onValueChange={(value) => setCreateForm((prev) => ({ ...prev, type_stage: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selectionner un type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_STAGE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {enumToLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Niveau requis</Label>
                    <Select
                      value={createForm.niveau_requis || undefined}
                      onValueChange={(value) => setCreateForm((prev) => ({ ...prev, niveau_requis: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selectionner un niveau" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIVEAU_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {enumToLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="project-max">Nombre max de stagiaires</Label>
                    <Input
                      id="project-max"
                      type="number"
                      min="1"
                      value={createForm.nombre_max_stagiaires}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, nombre_max_stagiaires: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="project-duration">Duree (semaines)</Label>
                    <Input
                      id="project-duration"
                      type="number"
                      min="1"
                      value={createForm.duree_semaines}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, duree_semaines: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="project-charge">Charge hebdo (h)</Label>
                    <Input
                      id="project-charge"
                      type="number"
                      min="1"
                      max="40"
                      value={createForm.charge_hebdo}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, charge_hebdo: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Complexite</Label>
                    <Select
                      value={createForm.complexite}
                      onValueChange={(value) => setCreateForm((prev) => ({ ...prev, complexite: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir une complexite" />
                      </SelectTrigger>
                      <SelectContent>
                        {RANK_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option} / 5
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Priorite</Label>
                    <Select
                      value={createForm.priorite}
                      onValueChange={(value) => setCreateForm((prev) => ({ ...prev, priorite: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir une priorite" />
                      </SelectTrigger>
                      <SelectContent>
                        {RANK_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option} / 5
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Contenu du projet</p>
                  <p className="text-xs text-muted-foreground">Donnez une vision claire de la mission et des resultats attendus.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="project-description">Description</Label>
                  <Textarea
                    id="project-description"
                    value={createForm.description}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Contexte, enjeux et valeur du projet..."
                    className="min-h-24"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="project-objectifs">Objectifs</Label>
                    <Textarea
                      id="project-objectifs"
                      value={createForm.objectifs}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, objectifs: event.target.value }))}
                      placeholder="Objectifs pedagogiques et operationnels..."
                      className="min-h-28"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="project-livrables">Livrables</Label>
                    <Textarea
                      id="project-livrables"
                      value={createForm.livrables}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, livrables: event.target.value }))}
                      placeholder="Rapport, application, documentation, tableau de bord..."
                      className="min-h-28"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Competences</p>
                  <p className="text-xs text-muted-foreground">Selectionnez les competences suggerees ou ajoutez des besoins plus specifiques.</p>
                </div>

                <div className="space-y-2">
                  <Label>Competences selectionnees</Label>
                  {createForm.competences.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Aucune competence selectionnee pour le moment.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {createForm.competences.map((competence) => (
                        <button
                          key={competence}
                          type="button"
                          onClick={() => removeCompetence(competence)}
                          className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                        >
                          {competence}
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Suggestions</Label>
                  {availableCompetenceOptions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Choisissez un departement ou ajoutez une competence personnalisee.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableCompetenceOptions.map((competence) => {
                        const isSelected = createForm.competences.includes(competence)
                        return (
                          <Button
                            key={competence}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setCreateForm((prev) => ({
                              ...prev,
                              competences: toggleStringValue(prev.competences, competence),
                            }))}
                          >
                            {competence}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    value={customCompetence}
                    onChange={(event) => setCustomCompetence(event.target.value)}
                    placeholder="Ajouter une competence personnalisee"
                  />
                  <Button type="button" variant="outline" className="gap-1.5" onClick={addCustomCompetence}>
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Tags et fiche PDF</p>
                  <p className="text-xs text-muted-foreground">Ajoutez des etiquettes de navigation et une fiche projet si besoin.</p>
                </div>

                <div className="space-y-2">
                  <Label>Tags selectionnes</Label>
                  {createForm.tags.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Aucun tag selectionne pour le moment.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {createForm.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                        >
                          {tag}
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Suggestions de tags</Label>
                  {availableTagOptions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Les suggestions backend sont vides pour le moment. Vous pouvez saisir vos propres tags.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableTagOptions.map((tag) => {
                        const isSelected = createForm.tags.includes(tag)
                        return (
                          <Button
                            key={tag}
                            type="button"
                            variant={isSelected ? "secondary" : "outline"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setCreateForm((prev) => ({
                              ...prev,
                              tags: toggleStringValue(prev.tags, tag),
                            }))}
                          >
                            {tag}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    value={customTag}
                    onChange={(event) => setCustomTag(event.target.value)}
                    placeholder="Ajouter un tag personnalise"
                  />
                  <Button type="button" variant="outline" className="gap-1.5" onClick={addCustomTag}>
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-file">Fiche PDF optionnelle</Label>
                  <Input
                    key={fileInputKey}
                    id="project-file"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={updateCreateFile}
                  />
                  <p className="text-xs text-muted-foreground">Format PDF uniquement, taille maximale 5 MB.</p>
                  {createForm.fiche_pdf ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      <span>{createForm.fiche_pdf.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800"
                        onClick={() => {
                          setCreateForm((prev) => ({ ...prev, fiche_pdf: null }))
                          setFileInputKey((prev) => prev + 1)
                        }}
                      >
                        Retirer
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => closeCreateDialog()} disabled={isCreatingProject}>
                Annuler
              </Button>
              <Button onClick={() => void handleCreateProject()} disabled={isCreatingProject}>
                {isCreatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Creer le projet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  )
}
