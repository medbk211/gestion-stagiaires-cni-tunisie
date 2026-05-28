import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AppBrand } from "@/components/brand/app-brand"
import { ApiError, requestJson } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ProjetSelectionRead {
  projet_id: number
  code_projet: string
  intitule: string
  description: string | null
  objectifs: string | null
  livrables: string | null
  departement: string | null
  type_stage: string | null
  duree_semaines: number | null
  niveau_requis: string | null
  competences: string[]
}

interface SelectionProjetResponse {
  projets: ProjetSelectionRead[]
  date_expiration: string
}

interface ChoixProjetResponse {
  message: string
  projet_id: number
  projet_intitule: string | null
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const source = value.includes("T") ? value : `${value}T00:00:00`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateTime(value: string | null | undefined): string {
  const parsed = parseDate(value)
  if (!parsed) {
    return "-"
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
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

export default function SelectionProjetPage() {
  const [token] = useState(() => {
    if (typeof window === "undefined") {
      return ""
    }
    return new URLSearchParams(window.location.search).get("token")?.trim() || ""
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [actionError, setActionError] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [payload, setPayload] = useState<SelectionProjetResponse | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  useEffect(() => {
    if (!token || typeof window === "undefined") {
      return
    }

    const params = new URLSearchParams(window.location.search)
    if (!params.has("token")) {
      return
    }

    params.delete("token")
    const nextQuery = params.toString()
    const cleanUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`
    window.history.replaceState({}, document.title, cleanUrl)
  }, [token])

  useEffect(() => {
    let isMounted = true

    async function loadProjects() {
      if (!token) {
        setLoadError("Lien invalide: token manquant.")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError("")

      try {
        const response = await requestJson<SelectionProjetResponse>(
          `/choix-projet/selection-projet?token=${encodeURIComponent(token)}`,
        )
        if (!isMounted) {
          return
        }
        setPayload(response)
        setSelectedProjectId(response.projets[0]?.projet_id ?? null)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setLoadError(asErrorMessage(error, "Chargement des projets impossible pour le moment."))
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      isMounted = false
    }
  }, [token])

  const selectedProject = useMemo(
    () => payload?.projets.find((project) => project.projet_id === selectedProjectId) || null,
    [payload?.projets, selectedProjectId],
  )

  const hasProjects = Boolean(payload?.projets.length)
  const canConfirm = Boolean(selectedProjectId && hasProjects && !actionSuccess && !isSubmitting)

  async function handleConfirmSelection() {
    if (!selectedProjectId || !token) {
      return
    }

    const confirmed = window.confirm("Confirmer ce projet comme choix final ? Cette action est irreversible.")
    if (!confirmed) {
      return
    }

    setActionError("")
    setActionSuccess("")
    setIsSubmitting(true)

    try {
      const response = await requestJson<ChoixProjetResponse>("/choix-projet/choisir-projet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          projet_id: selectedProjectId,
        }),
      })

      setActionSuccess(response.message || "Projet choisi avec succes.")
    } catch (error) {
      setActionError(asErrorMessage(error, "Validation du choix impossible pour le moment."))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_5%,rgba(14,165,233,0.16),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(20,184,166,0.18),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef6fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card className="border-slate-200/80 bg-white/90 shadow-lg shadow-sky-100/60 backdrop-blur">
          <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <AppBrand subtitle="Choix de projet de stage" />
              <Badge className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                Lien securise
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Portail Candidat</p>
                <h1 className="mt-2 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                  Selection finale du projet de stage
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Comparez les options proposees puis confirmez un seul projet. Une fois valide, le choix est verrouille.
                </p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-teal-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Echeance</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarClock className="h-4 w-4 text-sky-700" />
                  {formatDateTime(payload?.date_expiration)}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  En cas d expiration, contactez l administration pour relancer un cycle de propositions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {loadError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {actionSuccess}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="border-slate-200/80 bg-white/95 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-4">
              <CardTitle className="text-lg text-slate-900">Projets proposes</CardTitle>
              <CardDescription className="text-slate-600">
                Selectionnez un projet puis confirmez votre choix.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-5">
              {isLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des propositions...
                </div>
              ) : !hasProjects ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  Aucune proposition disponible pour ce lien.
                </div>
              ) : (
                <div className="space-y-3">
                  {payload?.projets.map((project, index) => {
                    const isSelected = selectedProjectId === project.projet_id
                    return (
                      <button
                        key={project.projet_id}
                        type="button"
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left transition-all",
                          isSelected
                            ? "border-sky-300 bg-sky-50/70 shadow-sm shadow-sky-100"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                        )}
                        onClick={() => setSelectedProjectId(project.projet_id)}
                        disabled={Boolean(actionSuccess)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Option {index + 1}
                            </p>
                            <p className="mt-1 truncate text-base font-semibold text-slate-900">
                              {project.intitule}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {project.code_projet} â€¢ {enumToLabel(project.departement)}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "mt-1 h-4 w-4 rounded-full border",
                              isSelected ? "border-sky-600 bg-sky-600" : "border-slate-300 bg-white",
                            )}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full border-slate-300 bg-white text-slate-700">
                            {enumToLabel(project.type_stage)}
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-slate-300 bg-white text-slate-700">
                            Niveau: {enumToLabel(project.niveau_requis)}
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-slate-300 bg-white text-slate-700">
                            Duree: {project.duree_semaines ? `${project.duree_semaines} semaines` : "-"}
                          </Badge>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <Button
                  type="button"
                  className="h-10 w-full bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => void handleConfirmSelection()}
                  disabled={!canConfirm}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirmation en cours...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Confirmer mon choix
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-slate-900">Projet selectionne</CardTitle>
                <CardDescription className="text-slate-600">
                  Apercu detaille de l option actuellement choisie.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {!selectedProject ? (
                  <p className="text-sm text-slate-600">Selectionnez un projet pour afficher les details.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Intitule</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{selectedProject.intitule}</p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Description</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                        {selectedProject.description?.trim() || "Description non renseignee."}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Objectifs</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                        {selectedProject.objectifs?.trim() || "Objectifs non renseignes."}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Livrables</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                        {selectedProject.livrables?.trim() || "Livrables non renseignes."}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Competences</p>
                      {selectedProject.competences?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedProject.competences.map((skill, index) => (
                            <Badge
                              key={`${selectedProject.projet_id}-${index}`}
                              variant="outline"
                              className="rounded-full border-teal-200 bg-teal-50 text-teal-800"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-slate-700">Aucune competence specifique mentionnee.</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-sky-100 bg-gradient-to-br from-sky-50 via-white to-teal-50 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Processus</p>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Rocket className="h-4 w-4 text-sky-700" />
                  Comparez les propositions.
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <ChevronRight className="h-4 w-4 text-sky-700" />
                  Validez un seul projet.
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Clock3 className="h-4 w-4 text-sky-700" />
                  Le lien expire a la date indiquee.
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Sparkles className="h-4 w-4 text-sky-700" />
                  L administration recoit votre choix automatiquement.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-600">
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
            Choix unique et trace. Conservez ce lien uniquement pour votre usage personnel.
          </p>
          <Link to="/" className="font-semibold text-slate-700 hover:text-slate-900">
            Retour a l accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
