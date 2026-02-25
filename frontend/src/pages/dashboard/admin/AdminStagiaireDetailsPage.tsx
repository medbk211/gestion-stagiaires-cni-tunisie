import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  GraduationCap,
  Loader2,
  Star,
  UserRound,
} from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface EncadreurRead {
  id: number
  nom: string
  prenom: string
  email: string
  departement: string | null
}

interface ProjetRead {
  id: number
  code_projet: string
  intitule: string
  description: string
  objectifs: string
  livrables: string
  departement: string
  type_stage: string
}

interface StagiaireEditFormState {
  nom: string
  prenom: string
  email: string
  etablissement: string
  niveau_etude: string
  encadreur_id: string
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

function buildInitialEditForm(stagiaire: StagiaireRead | null): StagiaireEditFormState {
  return {
    nom: stagiaire?.nom || "",
    prenom: stagiaire?.prenom || "",
    email: stagiaire?.email || "",
    etablissement: stagiaire?.etablissement || "",
    niveau_etude: stagiaire?.niveau_etude || "",
    encadreur_id: stagiaire?.encadreur_id ? String(stagiaire.encadreur_id) : "",
  }
}

function getDaysRemaining(value: string | null | undefined): number | null {
  const parsed = parseDate(value)
  if (!parsed) {
    return null
  }
  const diffMs = parsed.getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function pickPreferredStage(current: StageRead | null, candidate: StageRead): StageRead {
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

function StatusBadge({ status }: { status: string | null | undefined }) {
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

export default function AdminStagiaireDetailsPage() {
  const navigate = useNavigate()
  const { stagiaireId } = useParams()
  const { navItems, userName, userRole, sidebarWarning } = useAdminSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [stagiaire, setStagiaire] = useState<StagiaireRead | null>(null)
  const [progress, setProgress] = useState<StagiaireProgressResponse | null>(null)
  const [stage, setStage] = useState<StageRead | null>(null)
  const [encadreur, setEncadreur] = useState<EncadreurRead | null>(null)
  const [project, setProject] = useState<ProjetRead | null>(null)
  const [encadreurs, setEncadreurs] = useState<EncadreurRead[]>([])

  const [actionError, setActionError] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState<StagiaireEditFormState>(buildInitialEditForm(null))

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
    setActionError("")

    const accessToken = localStorage.getItem("cni_access_token")
    if (!accessToken) {
      setIsLoading(false)
      navigate("/connexion", { replace: true })
      return
    }

    try {
      const [stagiaireResult, progressResult, stagesResult, encadreursResult] = await Promise.allSettled([
        requestAuthJson<StagiaireRead>(`/stagiaires/${numericId}`),
        requestAuthJson<StagiaireProgressResponse>(`/stagiaires/${numericId}/progress`),
        requestAuthJson<StageRead[]>("/Stages/?limit=500"),
        requestAuthJson<EncadreurRead[]>("/encadreur/"),
      ] as const)

      if (
        [stagiaireResult, progressResult, stagesResult, encadreursResult].some(
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

      const nextEncadreurs = encadreursResult.status === "fulfilled" ? encadreursResult.value : []
      if (encadreursResult.status === "rejected") {
        warnings.push(`Liste encadreurs: ${asErrorMessage(encadreursResult.reason, "indisponible")}`)
      }

      let selectedStage: StageRead | null = null
      for (const candidate of stages) {
        if (candidate.stagiaire_id !== numericId) {
          continue
        }
        selectedStage = pickPreferredStage(selectedStage, candidate)
      }

      let nextEncadreur: EncadreurRead | null = null
      if (nextStagiaire.encadreur_id) {
        try {
          nextEncadreur = await requestAuthJson<EncadreurRead>(`/encadreur/${nextStagiaire.encadreur_id}`)
        } catch (error) {
          if (isApiErrorStatus(error, 401)) {
            throw error
          }
          warnings.push(`Encadreur: ${asErrorMessage(error, "indisponible")}`)
        }
      }

      let nextProject: ProjetRead | null = null
      if (selectedStage) {
        try {
          nextProject = await requestAuthJson<ProjetRead>(`/Project/projets/by-stage/${selectedStage.id}`)
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
      setEncadreur(nextEncadreur)
      setProject(nextProject)
      setEncadreurs(nextEncadreurs)
      setEditForm(buildInitialEditForm(nextStagiaire))
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

  function openEditDialog() {
    if (!stagiaire) {
      return
    }
    setActionError("")
    setActionSuccess("")
    setEditForm(buildInitialEditForm(stagiaire))
    setIsEditDialogOpen(true)
  }

  async function runSaveEdit() {
    if (!stagiaire) {
      return
    }

    const nom = editForm.nom.trim()
    const prenom = editForm.prenom.trim()
    const email = editForm.email.trim()

    if (!nom || !prenom || !email) {
      setActionError("Nom, prenom et email sont obligatoires.")
      return
    }

    setActionError("")
    setActionSuccess("")
    setIsSavingEdit(true)

    try {
      const updated = await requestAuthJson<StagiaireRead>(`/stagiaires/${stagiaire.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nom,
          prenom,
          email,
          etablissement: editForm.etablissement.trim() || null,
          niveau_etude: editForm.niveau_etude.trim() || null,
          encadreur_id: editForm.encadreur_id ? Number(editForm.encadreur_id) : null,
        }),
      })

      setStagiaire(updated)
      setEncadreur(updated.encadreur_id ? encadreurs.find((item) => item.id === updated.encadreur_id) || null : null)
      setEditForm(buildInitialEditForm(updated))
      setIsEditDialogOpen(false)
      setActionSuccess("Profil stagiaire mis a jour avec succes.")
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        clearAuthSession()
        navigate("/connexion", { replace: true })
        return
      }
      setActionError(asErrorMessage(error, "Mise a jour impossible pour le moment."))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const full = `${stagiaire?.prenom || ""} ${stagiaire?.nom || ""}`.trim() || "Stagiaire"
  const progressPct = progress?.progress_pct || 0
  const startDate = stagiaire?.date_debut_stage || stage?.date_debut
  const endDate = stagiaire?.date_fin_stage || stage?.date_fin
  const daysRemaining = getDaysRemaining(endDate)

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          kicker="Fiche stagiaire"
          title={full}
          subtitle={stagiaire?.email || "Details complets du stagiaire"}
          actions={(
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={openEditDialog} disabled={!stagiaire || isLoading}>
                <Edit className="h-3.5 w-3.5" />
                Modifier
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/admin/stagiaires")}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour
              </Button>
            </div>
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

        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {actionSuccess}
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
                  <CardTitle className="text-base">Informations generales</CardTitle>
                  <CardDescription>Profil et statut de stage du stagiaire.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={stage?.statut_stage || stagiaire.statut_stage} />
                    <Badge variant="secondary">{enumToLabel(stagiaire.type_stage)}</Badge>
                    {stagiaire.niveau_etude && <Badge variant="outline">{enumToLabel(stagiaire.niveau_etude)}</Badge>}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Periode</p>
                      <p className="mt-1 font-semibold text-foreground">{formatDate(startDate)} - {formatDate(endDate)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {daysRemaining !== null
                          ? daysRemaining >= 0
                            ? `${daysRemaining} jour(s) restants`
                            : `Stage depasse de ${Math.abs(daysRemaining)} jour(s)`
                          : "Date de fin indisponible"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Etablissement</p>
                      <p className="mt-1 font-semibold text-foreground">{stagiaire.etablissement || "-"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Matricule: {stagiaire.matricule || "-"}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5" />
                      Objectif de stage
                    </div>
                    <p className="mt-2 text-sm text-foreground">
                      {stage?.texte_objectif || "Objectif non defini pour ce stage."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Progression</CardTitle>
                  <CardDescription>Synthese des taches et evaluations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Avancement global</p>
                    <p className="text-sm font-bold text-foreground">{progressPct}%</p>
                  </div>
                  <Progress value={progressPct} className="h-2" />

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Taches totales</p>
                      <p className="mt-1 font-semibold text-foreground">{progress?.tasks_total || 0}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Taches terminees</p>
                      <p className="mt-1 font-semibold text-emerald-700">{progress?.tasks_done || 0}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">En cours</p>
                      <p className="mt-1 font-semibold text-indigo-700">{progress?.tasks_in_progress || 0}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Retard</p>
                      <p className="mt-1 font-semibold text-amber-700">{progress?.retard || 0}</p>
                    </div>
                  </div>
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
                  <CardTitle className="text-base">Projet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!project ? (
                    <p className="text-muted-foreground">Aucun projet associe au stage pour le moment.</p>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">{project.code_projet} - {project.intitule}</p>
                      <p className="text-muted-foreground">{enumToLabel(project.departement)} - {enumToLabel(project.type_stage)}</p>
                      <p className="text-muted-foreground">{project.description || "Description indisponible."}</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Indicateurs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4" />
                    ID stagiaire: {stagiaire.id}
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Niveau: {enumToLabel(stagiaire.niveau_etude)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Moyenne: {progress?.moyenne_note ?? "-"}
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Evaluations: {progress?.evaluations_count || 0}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Validation: {formatDate(stagiaire.date_validation)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Creation: {formatDate(stagiaire.dateCreation)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le stagiaire</DialogTitle>
              <DialogDescription>
                Mettez a jour les informations du profil et l affectation encadreur.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-1">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="stagiaire-nom">Nom</Label>
                  <Input
                    id="stagiaire-nom"
                    value={editForm.nom}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, nom: event.target.value }))}
                    placeholder="Nom"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stagiaire-prenom">Prenom</Label>
                  <Input
                    id="stagiaire-prenom"
                    value={editForm.prenom}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, prenom: event.target.value }))}
                    placeholder="Prenom"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stagiaire-email">Email</Label>
                <Input
                  id="stagiaire-email"
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="email@cni.tn"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stagiaire-etab">Etablissement</Label>
                <Input
                  id="stagiaire-etab"
                  value={editForm.etablissement}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, etablissement: event.target.value }))}
                  placeholder="Etablissement"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stagiaire-niveau">Niveau etude</Label>
                <Input
                  id="stagiaire-niveau"
                  value={editForm.niveau_etude}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, niveau_etude: event.target.value }))}
                  placeholder="Licence, Master, Ingenieur..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Encadreur</Label>
                <Select
                  value={editForm.encadreur_id || "__none__"}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, encadreur_id: value === "__none__" ? "" : value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selectionner un encadreur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun encadreur</SelectItem>
                    {encadreurs.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {fullName(item.prenom, item.nom)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSavingEdit}>
                Annuler
              </Button>
              <Button onClick={() => void runSaveEdit()} disabled={isSavingEdit}>
                {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  )
}
