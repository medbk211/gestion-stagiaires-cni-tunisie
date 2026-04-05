import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileText, Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useAdminSidebar } from "@/hooks/use-admin-sidebar"

interface StagiaireRead {
  id: number
  nom: string
  prenom: string
  email: string
}

interface StageRead {
  id: number
  date_debut: string
  date_fin: string
  statut_stage: string
  stagiaire_id: number
}

interface AttestationRead {
  id: number
  stagiaire_id: number
  stage_id: number
  numero_attestation: string
  date_debut_stage: string
  date_fin_stage: string
  description: string | null
  created_at: string
  updated_at: string
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const source = value.includes("T") ? value : `${value}T00:00:00`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateTime(value: string | null | undefined): string {
  const parsed = parseDate(value)
  return parsed ? DATE_TIME_FORMATTER.format(parsed) : "-"
}

function formatDateTimeLocalValue(value: string | null | undefined): string {
  const parsed = parseDate(value)
  if (!parsed) return ""

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  const hours = String(parsed.getHours()).padStart(2, "0")
  const minutes = String(parsed.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function fullName(prenom: string | null | undefined, nom: string | null | undefined): string {
  return `${prenom || ""} ${nom || ""}`.trim()
}

export default function AdminAttestationsPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole } = useAdminSidebar()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")

  const [attestations, setAttestations] = useState<AttestationRead[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [stagiaires, setStagiaires] = useState<StagiaireRead[]>([])
  const [stages, setStages] = useState<StageRead[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState("")

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [stagiaireId, setStagiaireId] = useState("")
  const [stageId, setStageId] = useState("")
  const [dateDebut, setDateDebut] = useState("")
  const [dateFin, setDateFin] = useState("")
  const [description, setDescription] = useState("")
  const [dialogError, setDialogError] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const availableStageByStagiaireId = useMemo(() => {
    const usedStageIds = new Set(attestations.map((attestation) => attestation.stage_id))
    const nextMap = new Map<number, StageRead>()

    const sortedStages = [...stages]
      .filter((stage) => {
        const normalizedStatus = (stage.statut_stage || "").toUpperCase()
        return !usedStageIds.has(stage.id) && (normalizedStatus === "EN_COURS" || normalizedStatus === "TERMINE")
      })
      .sort((a, b) => {
        const timeA = parseDate(a.date_fin)?.getTime() || parseDate(a.date_debut)?.getTime() || a.id
        const timeB = parseDate(b.date_fin)?.getTime() || parseDate(b.date_debut)?.getTime() || b.id
        return timeB - timeA
      })

    for (const stage of sortedStages) {
      if (!nextMap.has(stage.stagiaire_id)) {
        nextMap.set(stage.stagiaire_id, stage)
      }
    }

    return nextMap
  }, [attestations, stages])

  const availableStagiaires = useMemo(
    () => stagiaires.filter((stagiaire) => availableStageByStagiaireId.has(stagiaire.id)),
    [availableStageByStagiaireId, stagiaires],
  )

  const handleStagiaireChange = useCallback(
    (selectedStagiaireId: string) => {
      setStagiaireId(selectedStagiaireId)
      setStageId("")
      setDateDebut("")
      setDateFin("")
      setDialogError("")

      if (!selectedStagiaireId) return

      const selectedStage = availableStageByStagiaireId.get(Number(selectedStagiaireId))
      if (!selectedStage) {
        setDialogError("Aucun stage disponible pour ce stagiaire.")
        return
      }

      setStageId(String(selectedStage.id))
      setDateDebut(formatDateTimeLocalValue(selectedStage.date_debut))
      setDateFin(formatDateTimeLocalValue(selectedStage.date_fin))
    },
    [availableStageByStagiaireId],
  )

  const filteredAttestations = useMemo(() => {
    if (!searchTerm) return attestations
    const term = searchTerm.toLowerCase()
    return attestations.filter(
      (att) =>
        att.numero_attestation.toLowerCase().includes(term) ||
        String(att.stagiaire_id).includes(term),
    )
  }, [attestations, searchTerm])

  const loadAttestations = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true)
      else setIsRefreshing(true)

      setPageError("")

      const accessToken = localStorage.getItem("cni_access_token")
      if (!accessToken) {
        if (!silent) setIsLoading(false)
        else setIsRefreshing(false)
        navigate("/connexion", { replace: true })
        return
      }

      try {
        const data = await requestAuthJson<AttestationRead[]>("/attestations")
        setAttestations(data)
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Impossible de charger les attestations"))
      } finally {
        if (!silent) setIsLoading(false)
        else setIsRefreshing(false)
      }
    },
    [navigate],
  )

  const loadOptions = useCallback(async () => {
    const accessToken = localStorage.getItem("cni_access_token")
    if (!accessToken) {
      navigate("/connexion", { replace: true })
      return
    }

    setIsLoadingOptions(true)
    setOptionsError("")
    try {
      const [stagiairesResult, stagesResult] = await Promise.allSettled([
        requestAuthJson<StagiaireRead[]>("/stagiaires/?limit=1000"),
        requestAuthJson<StageRead[]>("/Stages/?limit=1000"),
      ] as const)

      if (
        [stagiairesResult, stagesResult].some(
          (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
        )
      ) {
        clearAuthSession()
        navigate("/connexion", { replace: true })
        return
      }

      const warnings: string[] = []

      if (stagiairesResult.status === "fulfilled") {
        setStagiaires(
          [...stagiairesResult.value].sort((a, b) => fullName(a.prenom, a.nom).localeCompare(fullName(b.prenom, b.nom))),
        )
      } else {
        setStagiaires([])
        warnings.push(`Stagiaires: ${asErrorMessage(stagiairesResult.reason, "indisponibles")}`)
      }

      if (stagesResult.status === "fulfilled") {
        setStages(stagesResult.value)
      } else {
        setStages([])
        warnings.push(`Stages: ${asErrorMessage(stagesResult.reason, "indisponibles")}`)
      }

      setOptionsError(warnings[0] || "")
    } catch (error) {
      setOptionsError(asErrorMessage(error, "Impossible de charger les stagiaires pour l'attestation"))
    } finally {
      setIsLoadingOptions(false)
    }
  }, [navigate])

  useEffect(() => {
    void loadAttestations()
    void loadOptions()
  }, [loadAttestations, loadOptions])

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open)

    if (open) {
      setDialogError("")
      void loadOptions()
      return
    }

    setStagiaireId("")
    setStageId("")
    setDateDebut("")
    setDateFin("")
    setDescription("")
    setDialogError("")
  }, [loadOptions])

  const handleCreateAttestation = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setDialogError("")

      if (!stagiaireId || !stageId || !dateDebut || !dateFin) {
        setDialogError("Tous les champs obligatoires doivent être remplis")
        return
      }

      setIsCreating(true)
      try {
        const newAtt = await requestAuthJson<AttestationRead>("/attestations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stagiaire_id: parseInt(stagiaireId),
            stage_id: parseInt(stageId),
            date_debut_stage: dateDebut,
            date_fin_stage: dateFin,
            description: description || null,
          }),
        })

        setAttestations((prev) => [newAtt, ...prev])
        setCreateDialogOpen(false)
        setStagiaireId("")
        setStageId("")
        setDateDebut("")
        setDateFin("")
        setDescription("")
      } catch (error) {
        console.error("Error creating attestation:", error)
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        if (isApiErrorStatus(error, 404)) {
          setDialogError("Stagiaire ou stage non trouvé")
          return
        }
        if (isApiErrorStatus(error, 409)) {
          setDialogError("Une attestation existe déjà pour ce stage")
          return
        }
        if (isApiErrorStatus(error, 400)) {
          setDialogError("La stage doit être terminée pour générer une attestation")
          return
        }
        setDialogError(asErrorMessage(error, "Impossible de créer l'attestation"))
      } finally {
        setIsCreating(false)
      }
    },
    [navigate, stagiaireId, stageId, dateDebut, dateFin, description],
  )

  const handleDeleteAttestation = useCallback(
    async (id: number) => {
      if (!confirm("Êtes-vous sûr de vouloir supprimer cette attestation ?")) return

      try {
        await requestAuthJson(`/attestations/${id}`, { method: "DELETE" })
        setAttestations((prev) => prev.filter((att) => att.id !== id))
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Impossible de supprimer l'attestation"))
      }
    },
    [navigate],
  )

  const handleDownload = (id: number, numero: string) => {
    const downloadLink = `/attestations/${id}/download`
    const a = document.createElement("a")
    a.href = downloadLink
    a.download = `${numero}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Gestion des Attestations"
          subtitle="Créer et gérer les attestations de stage pour les stagiaires"
          actions={(
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void loadAttestations(true)}
                disabled={isLoading || isRefreshing}
                className="gap-2"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rafraîchissement...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Rafraîchir
                  </>
                )}
              </Button>
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <FileText className="h-4 w-4" />
                Nouvelle Attestation
              </Button>
            </div>
          )}
        />

        {pageError && (
          <Card className="border-red-200 bg-red-50/70">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-700">{pageError}</p>
              <Button
                variant="outline"
                className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                onClick={() => void loadAttestations()}
              >
                Réessayer
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card className="border-indigo-100 bg-white/90">
            <CardContent className="flex min-h-72 items-center justify-center gap-3 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              Chargement des attestations...
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par numéro d'attestation ou ID stagiaire..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </CardHeader>
            </Card>

            {filteredAttestations.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                  Aucune attestation trouvée
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredAttestations.map((attestation) => (
                  <Card key={attestation.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Numéro</p>
                          <p className="font-mono font-semibold text-foreground">
                            {attestation.numero_attestation}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Stagiaire ID</p>
                          <p className="text-sm font-semibold text-foreground">
                            {attestation.stagiaire_id}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Stage ID</p>
                          <p className="text-sm font-semibold text-foreground">
                            {attestation.stage_id}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Date Création</p>
                          <p className="text-sm text-foreground">{formatDateTime(attestation.created_at)}</p>
                        </div>
                        {attestation.description && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-medium text-muted-foreground">Description</p>
                            <p className="text-sm text-foreground">{attestation.description}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(attestation.id, attestation.numero_attestation)}
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Télécharger
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDeleteAttestation(attestation.id)}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une Attestation</DialogTitle>
              <DialogDescription>
                Générer une nouvelle attestation de stage pour un stagiaire
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAttestation} className="space-y-4">
              {optionsError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {optionsError}
                </div>
              )}
              {dialogError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {dialogError}
                </div>
              )}
              <div>
                <Label htmlFor="stagiaire-id">Stagiaire *</Label>
                <Select value={stagiaireId} onValueChange={handleStagiaireChange}>
                  <SelectTrigger id="stagiaire-id" disabled={isLoadingOptions}>
                    <SelectValue placeholder="Sélectionner un stagiaire..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStagiaires.length === 0 ? (
                      <SelectItem value="__no-stagiaire" disabled>
                        Aucun stagiaire disponible
                      </SelectItem>
                    ) : (
                      availableStagiaires.map((stag) => (
                        <SelectItem key={stag.id} value={String(stag.id)}>
                          {fullName(stag.prenom, stag.nom)} ({stag.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!isLoadingOptions && !optionsError && availableStagiaires.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Aucun stagiaire avec un stage disponible n&apos;est prêt pour une nouvelle attestation.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="date-debut">Date Début Stage *</Label>
                <Input
                  id="date-debut"
                  type="datetime-local"
                  value={dateDebut}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="date-fin">Date Fin Stage *</Label>
                <Input
                  id="date-fin"
                  type="datetime-local"
                  value={dateFin}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optionnel)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes ou détails supplémentaires..."
                  className="h-24"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={isCreating}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || isLoadingOptions || availableStagiaires.length === 0}
                  className="gap-2"
                >
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Créer Attestation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  )
}
