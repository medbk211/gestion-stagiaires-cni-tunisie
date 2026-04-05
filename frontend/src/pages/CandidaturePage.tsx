import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  ClipboardCheck,
  CheckCircle2,
  FileText,
  FileUp,
  GraduationCap,
  Loader2,
  Save,
  Send,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, demandesApi } from "@/api"
import { CniBrand } from "@/components/brand/cni-brand"

interface DemandeFormOptions {
  departements: string[]
  types_stage: string[]
  competences_by_departement: Record<string, string[]>
  tags: string[]
}

interface DemandeCreateResponse {
  id: number
  message: string
}

interface CandidatureFormState {
  nom: string
  prenom: string
  email: string
  telephone: string
  etablissement: string
  niveau_etude: string
  departement_souhaite: string
  encadreur_souhaite: string
  description: string
  date_debut_souhaitee: string
  date_fin_souhaitee: string
  competences: string[]
  tags: string[]
}

interface CandidatureFilesState {
  cv: File | null
  convention: File | null
  lettre: File | null
}

const STEPS = [
  { id: 1, label: "Informations personnelles", icon: UserRound },
  { id: 2, label: "Informations du stage", icon: GraduationCap },
  { id: 3, label: "Documents", icon: Briefcase },
  { id: 4, label: "Confirmation", icon: Send },
] as const

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const DRAFT_STORAGE_KEY = "cni_candidature_draft_v1"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type CandidatureFieldKey = keyof CandidatureFormState | "cv" | "lettre"

interface CandidatureDraft {
  form: CandidatureFormState
  step: number
  saved_at: string
}

const INITIAL_FORM: CandidatureFormState = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  etablissement: "",
  niveau_etude: "",
  departement_souhaite: "",
  encadreur_souhaite: "",
  description: "",
  date_debut_souhaitee: "",
  date_fin_souhaitee: "",
  competences: [],
  tags: [],
}

const INITIAL_FILES: CandidatureFilesState = {
  cv: null,
  convention: null,
  lettre: null,
}

function enumToLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function CandidaturePage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<CandidatureFormState>(INITIAL_FORM)
  const [files, setFiles] = useState<CandidatureFilesState>(INITIAL_FILES)
  const [customTag, setCustomTag] = useState("")
  const [draftNotice, setDraftNotice] = useState("")
  const [options, setOptions] = useState<DemandeFormOptions | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState("")
  const [formError, setFormError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CandidatureFieldKey, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedDemandeId, setSubmittedDemandeId] = useState<number | null>(null)

  const availableCompetences = useMemo(() => {
    if (!options || !form.departement_souhaite) {
      return []
    }
    return options.competences_by_departement[form.departement_souhaite] || []
  }, [form.departement_souhaite, options])

  useEffect(() => {
    const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!rawDraft) {
      return
    }

    try {
      const draft = JSON.parse(rawDraft) as Partial<CandidatureDraft>
      if (!draft.form || typeof draft.form !== "object") {
        return
      }

      const restoredForm: CandidatureFormState = {
        ...INITIAL_FORM,
        ...draft.form,
        competences: Array.isArray(draft.form.competences) ? draft.form.competences : [],
        tags: Array.isArray(draft.form.tags) ? draft.form.tags : [],
      }

      setForm(restoredForm)
      if (typeof draft.step === "number" && draft.step >= 1 && draft.step <= STEPS.length) {
        setStep(draft.step)
      }
      setDraftNotice(
        `Brouillon restaure${draft.saved_at ? ` (sauvegarde du ${new Date(draft.saved_at).toLocaleString()})` : ""}.`,
      )
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadFormOptions() {
      setIsLoadingOptions(true)
      setOptionsError("")
      try {
        const payload = await demandesApi.options<DemandeFormOptions>({ signal: controller.signal })
        setOptions(payload)
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }
        if (err instanceof ApiError) {
          setOptionsError(err.message)
        } else {
          setOptionsError("Chargement impossible des options du formulaire.")
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOptions(false)
        }
      }
    }

    loadFormOptions()

    return () => controller.abort()
  }, [])

  function updateField<K extends keyof CandidatureFormState>(field: K, value: CandidatureFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev
      }
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function toggleCompetence(competence: string) {
    setForm((prev) => {
      const exists = prev.competences.includes(competence)
      return {
        ...prev,
        competences: exists
          ? prev.competences.filter((item) => item !== competence)
          : [...prev.competences, competence],
      }
    })
  }

  function toggleTag(tag: string) {
    setForm((prev) => {
      const exists = prev.tags.includes(tag)
      return {
        ...prev,
        tags: exists ? prev.tags.filter((item) => item !== tag) : [...prev.tags, tag],
      }
    })
  }

  function addCustomTag() {
    const trimmedTag = customTag.trim()
    if (!trimmedTag) {
      return
    }

    setForm((prev) => {
      if (prev.tags.some((tag) => tag.toLowerCase() === trimmedTag.toLowerCase())) {
        return prev
      }
      return { ...prev, tags: [...prev.tags, trimmedTag] }
    })
    setCustomTag("")
  }

  function updateFile<K extends keyof CandidatureFilesState>(field: K, value: File | null) {
    if (!value) {
      setFiles((prev) => ({ ...prev, [field]: null }))
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field as CandidatureFieldKey]
        return next
      })
      return
    }

    if (!value.name.toLowerCase().endsWith(".pdf")) {
      setFormError("Les documents doivent etre au format PDF.")
      return
    }

    if (value.size > MAX_FILE_SIZE_BYTES) {
      setFormError("Chaque fichier doit faire moins de 5 MB.")
      return
    }

    setFormError("")
    setFiles((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field as CandidatureFieldKey]
      return next
    })
  }

  function validateStep(targetStep: number): Partial<Record<CandidatureFieldKey, string>> {
    const errors: Partial<Record<CandidatureFieldKey, string>> = {}

    if (targetStep === 1) {
      if (!form.nom.trim()) errors.nom = "Le nom est obligatoire."
      if (!form.prenom.trim()) errors.prenom = "Le prenom est obligatoire."
      if (!form.email.trim()) {
        errors.email = "L email est obligatoire."
      } else if (!EMAIL_PATTERN.test(form.email.trim().toLowerCase())) {
        errors.email = "Adresse email invalide."
      }

      const normalizedPhone = form.telephone.replace(/\s+/g, "")
      if (!normalizedPhone) {
        errors.telephone = "Le telephone est obligatoire."
      } else if (normalizedPhone.length < 8) {
        errors.telephone = "Telephone invalide."
      }

      return errors
    }

    if (targetStep === 2) {
      if (!form.etablissement.trim()) errors.etablissement = "L etablissement est obligatoire."
      if (!form.niveau_etude) errors.niveau_etude = "Selectionnez un type de stage."
      if (!form.departement_souhaite) errors.departement_souhaite = "Selectionnez un departement."
      if (!form.date_debut_souhaitee) errors.date_debut_souhaitee = "La date de debut est obligatoire."
      if (!form.date_fin_souhaitee) errors.date_fin_souhaitee = "La date de fin est obligatoire."
      if (
        form.date_debut_souhaitee &&
        form.date_fin_souhaitee &&
        form.date_fin_souhaitee <= form.date_debut_souhaitee
      ) {
        errors.date_fin_souhaitee = "La date de fin doit etre apres la date de debut."
      }
      if (!form.encadreur_souhaite.trim()) errors.encadreur_souhaite = "Renseignez un encadreur souhaite."

      const descriptionLength = form.description.trim().length
      if (!descriptionLength) {
        errors.description = "La description est obligatoire."
      } else if (descriptionLength < 20) {
        errors.description = "Ajoutez au moins 20 caracteres pour decrire votre demande."
      }
      return errors
    }

    if (targetStep === 3) {
      if (!files.cv) errors.cv = "Le CV est obligatoire."
      if (!files.lettre) errors.lettre = "La lettre de motivation est obligatoire."
      return errors
    }

    return errors
  }

  function getValidationMessage(errors: Partial<Record<CandidatureFieldKey, string>>): string {
    const firstError = Object.values(errors).find((value) => Boolean(value))
    return firstError || "Verifiez les informations saisies."
  }

  function getFirstInvalidStep(errors: Partial<Record<CandidatureFieldKey, string>>): number {
    const stepOneKeys: CandidatureFieldKey[] = ["nom", "prenom", "email", "telephone"]
    const stepTwoKeys: CandidatureFieldKey[] = [
      "etablissement",
      "niveau_etude",
      "departement_souhaite",
      "date_debut_souhaitee",
      "date_fin_souhaitee",
      "encadreur_souhaite",
      "description",
    ]
    const stepThreeKeys: CandidatureFieldKey[] = ["cv", "lettre"]

    if (stepOneKeys.some((key) => errors[key])) return 1
    if (stepTwoKeys.some((key) => errors[key])) return 2
    if (stepThreeKeys.some((key) => errors[key])) return 3
    return 4
  }

  function saveDraft() {
    const draftPayload: CandidatureDraft = {
      form,
      step,
      saved_at: new Date().toISOString(),
    }
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload))
    setDraftNotice(
      `Brouillon enregistre (${new Date(draftPayload.saved_at).toLocaleString()}). Les fichiers doivent etre ajoutes a nouveau.`,
    )
    setFormError("")
  }

  function goToNextStep() {
    const validationErrors = validateStep(step)
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...validationErrors }))
      setFormError(getValidationMessage(validationErrors))
      return
    }

    setFieldErrors({})
    setFormError("")
    setStep((prev) => Math.min(4, prev + 1))
  }

  function goToPreviousStep() {
    setFormError("")
    setStep((prev) => Math.max(1, prev - 1))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const allErrors = {
      ...validateStep(1),
      ...validateStep(2),
      ...validateStep(3),
    }

    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors)
      setFormError(getValidationMessage(allErrors))
      setStep(getFirstInvalidStep(allErrors))
      return
    }

    setFieldErrors({})
    setFormError("")
    setIsSubmitting(true)

    try {
      const payload = new FormData()
      payload.append("nom", form.nom.trim())
      payload.append("prenom", form.prenom.trim())
      payload.append("email", form.email.trim().toLowerCase())
      payload.append("telephone", form.telephone.trim())
      payload.append("etablissement", form.etablissement.trim())
      payload.append("niveau_etude", form.niveau_etude)
      payload.append("departement_souhaite", form.departement_souhaite)
      payload.append("date_debut_souhaitee", form.date_debut_souhaitee)
      payload.append("date_fin_souhaitee", form.date_fin_souhaitee)
      payload.append("encadreur_souhaite", form.encadreur_souhaite.trim())
      payload.append("description", form.description.trim())

      form.competences.forEach((competence) => payload.append("competences", competence))
      form.tags.forEach((tag) => payload.append("tags", tag))

      if (files.cv) payload.append("cv", files.cv)
      if (files.convention) payload.append("convention", files.convention)
      if (files.lettre) payload.append("lettre", files.lettre)

      const response = await demandesApi.create<DemandeCreateResponse>(payload)

      setSubmittedDemandeId(response.id)
      setForm(INITIAL_FORM)
      setFiles(INITIAL_FILES)
      setStep(1)
      setCustomTag("")
      setDraftNotice("")
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message)
      } else {
        setFormError("Envoi impossible pour le moment. Reessayez plus tard.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedDemandeId !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50/80 via-white to-slate-50 px-6">
        <Card className="w-full max-w-xl border-indigo-100 bg-white/95 text-center shadow-xl shadow-indigo-100/70">
          <CardContent className="flex flex-col items-center gap-5 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Candidature envoyee</h2>
              <p className="text-sm text-slate-600">
                Votre demande a bien ete enregistree sous le numero
                <span className="mx-1 font-semibold text-indigo-700">#{submittedDemandeId}</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="outline" className="border-indigo-200 text-slate-700">
                <Link to="/">Retour accueil</Link>
              </Button>
              <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
                <Link to="/connexion">Aller a la connexion</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/80 via-white to-slate-50">
      <header className="sticky top-0 z-40 border-b border-indigo-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <CniBrand subtitle="Depot de candidature" />
          </Link>

          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Retour accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <section className="mb-8 rounded-3xl border border-indigo-100 bg-white/80 p-6 shadow-lg shadow-indigo-100/60">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Candidature de stage</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            Deposer une demande de stage
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Suivez les etapes pour completer votre dossier en toute clarte puis soumettez votre candidature.
          </p>
        </section>

        {draftNotice && (
          <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {draftNotice}
          </div>
        )}

        <div className="mb-4 h-2 w-full rounded-full bg-indigo-100">
          <div
            className="h-2 rounded-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>

        <nav className="mb-8" aria-label="Etapes du formulaire">
          <ol className="flex items-center gap-2">
            {STEPS.map((currentStep, index) => {
              const Icon = currentStep.icon
              const isActive = step === currentStep.id
              const isDone = step > currentStep.id
              return (
                <li key={currentStep.id} className="flex flex-1 items-center gap-2">
                  <div className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                        isDone
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : isActive
                            ? "border-indigo-600 bg-indigo-100 text-indigo-700"
                            : "border-indigo-100 bg-white text-slate-400",
                      ].join(" ")}
                    >
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={`hidden text-xs font-medium sm:block ${isActive ? "text-slate-900" : "text-slate-500"}`}>
                      {currentStep.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`mb-5 hidden h-0.5 flex-1 rounded-full sm:block ${isDone ? "bg-indigo-600" : "bg-indigo-100"}`} />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        {formError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
        )}

        {isLoadingOptions ? (
          <Card className="border-indigo-100 bg-white/90 shadow-lg shadow-indigo-100/60">
            <CardContent className="flex items-center justify-center gap-3 py-10 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              Chargement des options du formulaire...
            </CardContent>
          </Card>
        ) : optionsError ? (
          <Card className="border-red-200 bg-red-50/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-red-700">Options indisponibles</CardTitle>
              <CardDescription className="text-red-600">{optionsError}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-red-200 bg-white text-red-700 hover:bg-red-100"
              >
                Recharger la page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <Card className="border-indigo-100 bg-white/95 shadow-lg shadow-indigo-100/60">
                <CardHeader>
                  <CardTitle>Informations personnelles</CardTitle>
                  <CardDescription>Ces donnees seront utilisees pour votre suivi de candidature.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom</Label>
                    <Input
                      id="nom"
                      value={form.nom}
                      onChange={(event) => updateField("nom", event.target.value)}
                      placeholder="Ben Ali"
                      className="border-indigo-100 focus-visible:ring-indigo-500/40"
                      aria-invalid={fieldErrors.nom ? true : undefined}
                    />
                    {fieldErrors.nom && <p className="text-xs font-medium text-red-600">{fieldErrors.nom}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prenom</Label>
                    <Input
                      id="prenom"
                      value={form.prenom}
                      onChange={(event) => updateField("prenom", event.target.value)}
                      placeholder="Amira"
                      className="border-indigo-100 focus-visible:ring-indigo-500/40"
                      aria-invalid={fieldErrors.prenom ? true : undefined}
                    />
                    {fieldErrors.prenom && <p className="text-xs font-medium text-red-600">{fieldErrors.prenom}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="nom.prenom@email.tn"
                      className="border-indigo-100 focus-visible:ring-indigo-500/40"
                      aria-invalid={fieldErrors.email ? true : undefined}
                    />
                    {fieldErrors.email && <p className="text-xs font-medium text-red-600">{fieldErrors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Telephone</Label>
                    <Input
                      id="telephone"
                      value={form.telephone}
                      onChange={(event) => updateField("telephone", event.target.value)}
                      placeholder="+216 XX XXX XXX"
                      className="border-indigo-100 focus-visible:ring-indigo-500/40"
                      aria-invalid={fieldErrors.telephone ? true : undefined}
                    />
                    {fieldErrors.telephone && <p className="text-xs font-medium text-red-600">{fieldErrors.telephone}</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card className="border-indigo-100 bg-white/95 shadow-lg shadow-indigo-100/60">
                <CardHeader>
                  <CardTitle>Parcours et preferences</CardTitle>
                  <CardDescription>
                    Renseignez les informations du stage pour faciliter l evaluation de votre demande.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="etablissement">Etablissement</Label>
                      <Input
                        id="etablissement"
                        value={form.etablissement}
                        onChange={(event) => updateField("etablissement", event.target.value)}
                        placeholder="INSAT, ENIT, ESPRIT..."
                        className="border-indigo-100 focus-visible:ring-indigo-500/40"
                        aria-invalid={fieldErrors.etablissement ? true : undefined}
                      />
                      {fieldErrors.etablissement && (
                        <p className="text-xs font-medium text-red-600">{fieldErrors.etablissement}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="niveau_etude">Type de stage</Label>
                      <select
                        id="niveau_etude"
                        value={form.niveau_etude}
                        onChange={(event) => updateField("niveau_etude", event.target.value)}
                        className="h-10 w-full rounded-md border border-indigo-100 bg-white px-3 text-sm text-slate-700 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                        aria-invalid={fieldErrors.niveau_etude ? true : undefined}
                      >
                        <option value="">Choisir un type</option>
                        {options?.types_stage.map((type) => (
                          <option key={type} value={type}>
                            {enumToLabel(type)}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.niveau_etude && (
                        <p className="text-xs font-medium text-red-600">{fieldErrors.niveau_etude}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="departement_souhaite">Departement souhaite</Label>
                      <select
                        id="departement_souhaite"
                        value={form.departement_souhaite}
                        onChange={(event) => {
                          const nextDepartement = event.target.value
                          setForm((prev) => ({
                            ...prev,
                            departement_souhaite: nextDepartement,
                            competences: [],
                          }))
                          setFieldErrors((prev) => {
                            if (!prev.departement_souhaite) {
                              return prev
                            }
                            const next = { ...prev }
                            delete next.departement_souhaite
                            return next
                          })
                        }}
                        className="h-10 w-full rounded-md border border-indigo-100 bg-white px-3 text-sm text-slate-700 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                        aria-invalid={fieldErrors.departement_souhaite ? true : undefined}
                      >
                        <option value="">Choisir un departement</option>
                        {options?.departements.map((departement) => (
                          <option key={departement} value={departement}>
                            {enumToLabel(departement)}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.departement_souhaite && (
                        <p className="text-xs font-medium text-red-600">{fieldErrors.departement_souhaite}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date_debut_souhaitee">Date debut souhaitee</Label>
                      <Input
                        id="date_debut_souhaitee"
                        type="date"
                        value={form.date_debut_souhaitee}
                        onChange={(event) => updateField("date_debut_souhaitee", event.target.value)}
                        className="border-indigo-100 focus-visible:ring-indigo-500/40"
                        aria-invalid={fieldErrors.date_debut_souhaitee ? true : undefined}
                      />
                      {fieldErrors.date_debut_souhaitee && (
                        <p className="text-xs font-medium text-red-600">{fieldErrors.date_debut_souhaitee}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date_fin_souhaitee">Date fin souhaitee</Label>
                      <Input
                        id="date_fin_souhaitee"
                        type="date"
                        value={form.date_fin_souhaitee}
                        onChange={(event) => updateField("date_fin_souhaitee", event.target.value)}
                        className="border-indigo-100 focus-visible:ring-indigo-500/40"
                        aria-invalid={fieldErrors.date_fin_souhaitee ? true : undefined}
                      />
                      {fieldErrors.date_fin_souhaitee && (
                        <p className="text-xs font-medium text-red-600">{fieldErrors.date_fin_souhaitee}</p>
                      )}
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="encadreur_souhaite">Encadreur souhaite</Label>
                      <Input
                        id="encadreur_souhaite"
                        value={form.encadreur_souhaite}
                        onChange={(event) => updateField("encadreur_souhaite", event.target.value)}
                        placeholder="Nom de l encadreur ou departement cible"
                        className="border-indigo-100 focus-visible:ring-indigo-500/40"
                        aria-invalid={fieldErrors.encadreur_souhaite ? true : undefined}
                      />
                      {fieldErrors.encadreur_souhaite && (
                        <p className="text-xs font-medium text-red-600">{fieldErrors.encadreur_souhaite}</p>
                      )}
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="description">Description de la demande</Label>
                      <Textarea
                        id="description"
                        value={form.description}
                        onChange={(event) => updateField("description", event.target.value)}
                        placeholder="Decrivez vos objectifs, le contexte du stage et les attentes de mission."
                        rows={5}
                        className="border-indigo-100 focus-visible:ring-indigo-500/40"
                        aria-invalid={fieldErrors.description ? true : undefined}
                      />
                      {fieldErrors.description && (
                        <p className="text-xs font-medium text-red-600">{fieldErrors.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Competences (optionnel)</p>
                    {availableCompetences.length ? (
                      <div className="flex flex-wrap gap-2">
                        {availableCompetences.map((competence) => {
                          const active = form.competences.includes(competence)
                          return (
                            <button
                              key={competence}
                              type="button"
                              onClick={() => toggleCompetence(competence)}
                              className={[
                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                active
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-indigo-100 bg-white text-slate-600 hover:bg-indigo-50",
                              ].join(" ")}
                            >
                              {competence}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Selectionnez un departement pour afficher les competences recommandees.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <Card className="border-indigo-100 bg-white/95 shadow-lg shadow-indigo-100/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Documents
                  </CardTitle>
                  <CardDescription>
                    Joignez les documents obligatoires. Le CV et la lettre de motivation sont requis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Tags (optionnel)</p>
                    <div className="flex flex-wrap gap-2">
                      {options?.tags.map((tag) => {
                        const active = form.tags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={[
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                              active
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-indigo-100 bg-white text-slate-600 hover:bg-indigo-50",
                            ].join(" ")}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={customTag}
                        onChange={(event) => setCustomTag(event.target.value)}
                        placeholder="Ajouter un tag personnalise"
                        className="border-indigo-100 focus-visible:ring-indigo-500/40"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addCustomTag}
                        className="border-indigo-200 text-slate-700 hover:bg-indigo-50"
                      >
                        Ajouter tag
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FileField
                      id="cv"
                      label="CV"
                      file={files.cv}
                      onFileChange={(file) => updateFile("cv", file)}
                      error={fieldErrors.cv}
                    />
                    <FileField
                      id="convention"
                      label="Convention"
                      file={files.convention}
                      onFileChange={(file) => updateFile("convention", file)}
                    />
                    <FileField
                      id="lettre"
                      label="Lettre"
                      file={files.lettre}
                      onFileChange={(file) => updateFile("lettre", file)}
                      error={fieldErrors.lettre}
                    />
                  </div>
                  {(fieldErrors.cv || fieldErrors.lettre) && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {fieldErrors.cv || fieldErrors.lettre}
                    </div>
                  )}
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-700">
                    Les brouillons ne stockent pas les fichiers. Reajoutez vos documents avant soumission.
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 4 && (
              <Card className="border-indigo-100 bg-white/95 shadow-lg shadow-indigo-100/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                    Recapitulatif
                  </CardTitle>
                  <CardDescription>Verifiez vos informations avant envoi.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <SummaryBlock label="Nom complet" value={`${form.prenom} ${form.nom}`.trim()} />
                  <SummaryBlock label="Email" value={form.email} />
                  <SummaryBlock label="Telephone" value={form.telephone} />
                  <SummaryBlock label="Etablissement" value={form.etablissement} />
                  <SummaryBlock label="Type de stage" value={enumToLabel(form.niveau_etude)} />
                  <SummaryBlock label="Departement" value={enumToLabel(form.departement_souhaite)} />
                  <SummaryBlock label="Periode" value={`${form.date_debut_souhaitee} -> ${form.date_fin_souhaitee}`} />
                  <SummaryBlock label="Encadreur souhaite" value={form.encadreur_souhaite} />
                  <SummaryBlock label="Description" value={form.description} />
                  <SummaryBlock label="Competences" value={form.competences.join(", ")} />
                  <SummaryBlock label="Tags" value={form.tags.join(", ")} />
                  <SummaryBlock label="CV" value={files.cv?.name || ""} />
                  <SummaryBlock label="Convention" value={files.convention?.name || ""} />
                  <SummaryBlock label="Lettre" value={files.lettre?.name || ""} />
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-white/90 px-4 py-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveDraft}
                  className="gap-2 border-indigo-200 text-slate-700 hover:bg-indigo-50"
                >
                  <Save className="h-4 w-4" />
                  Enregistrer brouillon
                </Button>

                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPreviousStep}
                    className="gap-2 border-indigo-200 text-slate-700 hover:bg-indigo-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Precedent
                  </Button>
                )}
              </div>

              {step < 4 ? (
                <Button type="button" onClick={goToNextStep} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">
                  Suivant
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Soumettre la candidature
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

function FileField({
  id,
  label,
  file,
  error,
  onFileChange,
}: {
  id: string
  label: string
  file: File | null
  error?: string
  onFileChange: (file: File | null) => void
}) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
      <Label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">
        {label} (PDF)
      </Label>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileUp className="h-4 w-4 text-indigo-600" />
          Max 5 MB
        </div>
        <Input
          id={id}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          className="h-10 border-indigo-100 bg-white text-xs file:text-xs"
          aria-invalid={error ? true : undefined}
        />
        <p className="min-h-4 text-xs text-slate-500">{file ? file.name : "Aucun fichier selectionne"}</p>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      </div>
    </div>
  )
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</p>
    </div>
  )
}
