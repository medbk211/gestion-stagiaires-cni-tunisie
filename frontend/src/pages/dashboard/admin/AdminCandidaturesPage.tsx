import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApiError, buildApiUrl, buildAuthHeaders, clearAuthSession, extractErrorMessage, requestAuthJson } from "@/lib/api"
import { useAdminSidebar } from "@/hooks/use-admin-sidebar"

interface DemandeDocumentRead {
  id: number
  type: string
  file_path?: string
  created_at?: string
  status?: string
}

interface DemandeStageRead {
  id: number
  nom: string
  prenom: string
  email: string
  telephone: string
  etablissement: string
  niveau_etude: string
  departement_souhaite: string
  date_debut_souhaitee: string
  date_fin_souhaitee: string
  statut: string
  created_at: string
  documents: DemandeDocumentRead[]
}

interface EncadreurRead {
  id: number
  nom: string
  prenom: string
  email: string
  departement: string | null
  max_stagiaires: number
  actif_encadrement: boolean
}

interface StatutCount {
  statut: string
  count: number
}

interface DashboardStatsRead {
  totaux: {
    demandes: number
  }
  demandes_par_statut: StatutCount[]
}

interface PropositionProjetRead {
  id: number
  demande_id: number
  stagiaire_nom: string
  stagiaire_email: string
  projet_id: number
  projet_code: string
  projet_intitule: string
  departement: string | null
  statut: string
  token: string
  date_expiration: string | null
  date_choix: string | null
  created_at: string | null
}

interface AffectationDemandeRef {
  id: number
}

interface AffectationProjetRef {
  id: number
  code_projet: string
  intitule: string
  departement?: string
}

interface AffectationEncadreurRef {
  id: number
  nom: string
  prenom: string
}

interface AffectationReadDetailed {
  id: number
  demande?: AffectationDemandeRef
  demande_id?: number
  projet?: AffectationProjetRef
  projet_id?: number
  encadreur?: AffectationEncadreurRef
  encadreur_id?: number
  statut: string
  created_at?: string
}

interface DemandeFlowMeta {
  currentCycle: PropositionProjetRead[]
  chosen: PropositionProjetRead | null
  pendingCount: number
  latestExpiration: string | null
}

interface ProposerProjectsResponse {
  message: string
  token: string
  count_propositions: number
}

type FilterStatus = "ALL" | "EN_ATTENTE" | "EN_COURS" | "ACCEPTEE" | "REFUSEE"

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

const EMPTY_FLOW_META: DemandeFlowMeta = {
  currentCycle: [],
  chosen: null,
  pendingCount: 0,
  latestExpiration: null,
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

function findStatusCount(items: StatutCount[], key: string): number {
  const match = items.find((item) => (item.statut || "").toUpperCase() === key.toUpperCase())
  return match?.count || 0
}

function toStatusKey(value: string | null | undefined): string {
  return (value || "").toUpperCase()
}

function StatusBadge({ status }: { status: string }) {
  const key = toStatusKey(status)
  const meta =
    key === "ACCEPTEE"
      ? { label: "Acceptee", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : key === "REFUSEE"
        ? { label: "Refusee", className: "bg-red-50 text-red-700 border-red-200" }
        : key === "EN_COURS"
          ? { label: "En cours", className: "bg-indigo-50 text-indigo-700 border-indigo-200" }
          : { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`
}

function fileNameFromPath(path: string | null | undefined): string {
  if (!path) {
    return ""
  }
  const normalized = path.replace(/\\/g, "/")
  const parts = normalized.split("/")
  return parts[parts.length - 1] || ""
}

function documentTypeLabel(type: string | null | undefined): string {
  const key = (type || "").toUpperCase()
  if (key === "CV") {
    return "CV"
  }
  if (key === "LETTRE") {
    return "Lettre"
  }
  if (key === "CONVOCATION") {
    return "Convention"
  }
  if (key === "RAPPORT_FINAL") {
    return "Rapport final"
  }
  return enumToLabel(type)
}

function getAffectationDemandeId(affectation: AffectationReadDetailed): number | null {
  if (typeof affectation.demande_id === "number") {
    return affectation.demande_id
  }
  if (typeof affectation.demande?.id === "number") {
    return affectation.demande.id
  }
  return null
}

function getAffectationProjetId(affectation: AffectationReadDetailed): number | null {
  if (typeof affectation.projet_id === "number") {
    return affectation.projet_id
  }
  if (typeof affectation.projet?.id === "number") {
    return affectation.projet.id
  }
  return null
}

function getAffectationEncadreurId(affectation: AffectationReadDetailed): number | null {
  if (typeof affectation.encadreur_id === "number") {
    return affectation.encadreur_id
  }
  if (typeof affectation.encadreur?.id === "number") {
    return affectation.encadreur.id
  }
  return null
}

function PropositionStatusBadge({ status }: { status: string }) {
  const key = toStatusKey(status)
  const meta =
    key === "CHOISI"
      ? { label: "Choisi", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : key === "EN_ATTENTE"
        ? { label: "En attente", className: "bg-indigo-50 text-indigo-700 border-indigo-200" }
        : { label: "Expire", className: "bg-slate-100 text-slate-700 border-slate-200" }

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function DocumentStatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status || "pending").toLowerCase()
  const meta =
    key === "approved"
      ? { label: "Valide", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : key === "rejected"
        ? { label: "Rejete", className: "bg-red-50 text-red-700 border-red-200" }
        : { label: "En revue", className: "bg-slate-100 text-slate-700 border-slate-200" }

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function AdminCandidaturesPage() {
  const navigate = useNavigate()
  const { demandeId } = useParams()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useAdminSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)

  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [actionError, setActionError] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")

  const [demandes, setDemandes] = useState<DemandeStageRead[]>([])
  const [encadreurs, setEncadreurs] = useState<EncadreurRead[]>([])
  const [stats, setStats] = useState<DashboardStatsRead | null>(null)
  const [propositions, setPropositions] = useState<PropositionProjetRead[]>([])
  const [affectations, setAffectations] = useState<AffectationReadDetailed[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL")
  const [selectedEncadreurId, setSelectedEncadreurId] = useState("")
  const [statusReason, setStatusReason] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = 10
  const hasDetailRoute = typeof demandeId === "string"
  const selectedDemandeId = useMemo(() => {
    if (!demandeId) {
      return null
    }

    const parsed = Number(demandeId)
    return Number.isFinite(parsed) ? parsed : null
  }, [demandeId])

  const loadDemandes = useCallback(
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
        const [demandesResult, encadreursResult, statsResult, propositionsResult, affectationsResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<DemandeStageRead[]>("/projets-stage/demandes-stage?limit=500"),
          requestAuthJson<EncadreurRead[]>("/encadreur/available/"),
          requestAuthJson<DashboardStatsRead>("/statistiques/dashboard"),
          requestAuthJson<PropositionProjetRead[]>("/propositions_projets_router/list"),
          requestAuthJson<AffectationReadDetailed[]>("/affectation/?limit=500"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [demandesResult, encadreursResult, statsResult, propositionsResult, affectationsResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (demandesResult.status === "rejected") {
          throw demandesResult.reason
        }

        const warnings: string[] = []

        const nextDemandes = [...demandesResult.value].sort((a, b) => {
          const timeA = parseDate(a.created_at)?.getTime() || 0
          const timeB = parseDate(b.created_at)?.getTime() || 0
          return timeB - timeA
        })

        const nextEncadreurs = encadreursResult.status === "fulfilled"
          ? [...encadreursResult.value].sort((a, b) => {
              return fullName(a.prenom, a.nom).localeCompare(fullName(b.prenom, b.nom))
            })
          : []
        if (encadreursResult.status === "rejected") {
          warnings.push(`Encadreurs: ${asErrorMessage(encadreursResult.reason, "indisponibles")}`)
        }

        const nextStats = statsResult.status === "fulfilled" ? statsResult.value : null
        if (statsResult.status === "rejected") {
          warnings.push(`Statistiques: ${asErrorMessage(statsResult.reason, "indisponibles")}`)
        }

        const nextPropositions = propositionsResult.status === "fulfilled"
          ? [...propositionsResult.value].sort((a, b) => {
              const timeA = parseDate(a.created_at)?.getTime() || 0
              const timeB = parseDate(b.created_at)?.getTime() || 0
              return timeB - timeA
            })
          : []
        if (propositionsResult.status === "rejected") {
          warnings.push(`Propositions: ${asErrorMessage(propositionsResult.reason, "indisponibles")}`)
        }

        const nextAffectations = affectationsResult.status === "fulfilled"
          ? [...affectationsResult.value].sort((a, b) => {
              const timeA = parseDate(a.created_at)?.getTime() || a.id
              const timeB = parseDate(b.created_at)?.getTime() || b.id
              return timeB - timeA
            })
          : []
        if (affectationsResult.status === "rejected") {
          warnings.push(`Affectations: ${asErrorMessage(affectationsResult.reason, "indisponibles")}`)
        }

        if (sidebarResult.status === "rejected") {
          warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        setDemandes(nextDemandes)
        setEncadreurs(nextEncadreurs)
        setStats(nextStats)
        setPropositions(nextPropositions)
        setAffectations(nextAffectations)
        setDataWarning(warnings[0] || "")

        setSelectedEncadreurId((previous) => {
          if (previous && nextEncadreurs.some((item) => String(item.id) === previous)) {
            return previous
          }
          return nextEncadreurs[0] ? String(nextEncadreurs[0].id) : ""
        })
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement des candidatures impossible pour le moment."))
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
    void loadDemandes()
  }, [loadDemandes])

  const filteredDemandes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return demandes.filter((demande) => {
      const matchesStatus = filterStatus === "ALL" || toStatusKey(demande.statut) === filterStatus
      if (!matchesStatus) {
        return false
      }
      if (!query) {
        return true
      }

      const searchable = [
        String(demande.id),
        fullName(demande.prenom, demande.nom),
        demande.email,
        demande.etablissement,
        demande.departement_souhaite,
        demande.niveau_etude,
      ]
        .join(" ")
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [demandes, filterStatus, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, searchQuery])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDemandes.length / pageSize)),
    [filteredDemandes.length],
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const pagedDemandes = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredDemandes.slice(start, start + pageSize)
  }, [currentPage, filteredDemandes])

  const selectedDemande = useMemo(
    () => demandes.find((demande) => demande.id === selectedDemandeId) || null,
    [demandes, selectedDemandeId],
  )

  const openDemandeDetails = useCallback(
    (demandeIdToOpen: number) => {
      navigate(`/dashboard/admin/candidatures/${demandeIdToOpen}`)
    },
    [navigate],
  )

  const backToList = useCallback(() => {
    navigate("/dashboard/admin/candidatures")
  }, [navigate])

  const flowMetaByDemande = useMemo(() => {
    const grouped = new Map<number, PropositionProjetRead[]>()
    for (const proposition of propositions) {
      const list = grouped.get(proposition.demande_id) || []
      list.push(proposition)
      grouped.set(proposition.demande_id, list)
    }

    const computed = new Map<number, DemandeFlowMeta>()
    for (const [demandeId, allPropositions] of grouped.entries()) {
      const sorted = [...allPropositions].sort((a, b) => {
        const timeA = parseDate(a.created_at)?.getTime() || 0
        const timeB = parseDate(b.created_at)?.getTime() || 0
        return timeB - timeA
      })
      const latestToken = sorted[0]?.token
      const currentCycle = latestToken ? sorted.filter((item) => item.token === latestToken) : []
      const chosen = currentCycle.find((item) => toStatusKey(item.statut) === "CHOISI") || null
      const pendingCount = currentCycle.filter((item) => toStatusKey(item.statut) === "EN_ATTENTE").length
      computed.set(demandeId, {
        currentCycle,
        chosen,
        pendingCount,
        latestExpiration: currentCycle[0]?.date_expiration || null,
      })
    }

    return computed
  }, [propositions])

  const affectationByDemande = useMemo(() => {
    const map = new Map<number, AffectationReadDetailed>()
    for (const affectation of affectations) {
      const demandeId = getAffectationDemandeId(affectation)
      if (!demandeId) {
        continue
      }
      const existing = map.get(demandeId)
      if (!existing) {
        map.set(demandeId, affectation)
        continue
      }
      const existingTime = parseDate(existing.created_at)?.getTime() || existing.id
      const nextTime = parseDate(affectation.created_at)?.getTime() || affectation.id
      if (nextTime > existingTime) {
        map.set(demandeId, affectation)
      }
    }
    return map
  }, [affectations])

  const selectedFlowMeta = selectedDemande ? flowMetaByDemande.get(selectedDemande.id) || EMPTY_FLOW_META : EMPTY_FLOW_META
  const selectedAffectation = selectedDemande ? affectationByDemande.get(selectedDemande.id) || null : null
  const selectedAffectationEncadreurId = selectedAffectation ? getAffectationEncadreurId(selectedAffectation) : null
  const selectedAffectationProjetId = selectedAffectation ? getAffectationProjetId(selectedAffectation) : null
  const selectedProjectId = selectedAffectationProjetId || selectedFlowMeta.chosen?.projet_id || null
  const selectedEffectiveEncadreurId = selectedAffectationEncadreurId
    ? String(selectedAffectationEncadreurId)
    : selectedEncadreurId

  useEffect(() => {
    if (!selectedDemande) {
      return
    }
    if (selectedAffectationEncadreurId && selectedEncadreurId !== String(selectedAffectationEncadreurId)) {
      setSelectedEncadreurId(String(selectedAffectationEncadreurId))
      return
    }
    if (!selectedAffectationEncadreurId && !selectedEncadreurId && encadreurs[0]) {
      setSelectedEncadreurId(String(encadreurs[0].id))
    }
  }, [encadreurs, selectedAffectationEncadreurId, selectedDemande, selectedEncadreurId])

  const statsSummary = useMemo(() => {
    const local = (status: string) => demandes.filter((item) => toStatusKey(item.statut) === status).length
    return {
      total: stats?.totaux?.demandes ?? demandes.length,
      pending: stats ? findStatusCount(stats.demandes_par_statut || [], "EN_ATTENTE") : local("EN_ATTENTE"),
      inProgress: stats ? findStatusCount(stats.demandes_par_statut || [], "EN_COURS") : local("EN_COURS"),
      accepted: stats ? findStatusCount(stats.demandes_par_statut || [], "ACCEPTEE") : local("ACCEPTEE"),
      refused: stats ? findStatusCount(stats.demandes_par_statut || [], "REFUSEE") : local("REFUSEE"),
    }
  }, [demandes, stats])

  const runProposerAction = useCallback(
    async (demandeId: number) => {
      setActionError("")
      setActionSuccess("")
      setActionLoadingKey(`propose-${demandeId}`)

      try {
        const response = await requestAuthJson<ProposerProjectsResponse>(
          `/propositions_projets_router/demande/${demandeId}/proposer-projets`,
          { method: "POST" },
        )
        setActionSuccess(response.message || `Propositions envoyees pour la demande #${demandeId}.`)
        await loadDemandes({ silent: true })
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setActionError(asErrorMessage(error, "Envoi des propositions impossible pour le moment."))
      } finally {
        setActionLoadingKey(null)
      }
    },
    [loadDemandes, navigate],
  )

  const runAffectationAction = useCallback(
    async (demande: DemandeStageRead, projetId: number) => {
      setActionError("")
      setActionSuccess("")
      setActionLoadingKey(`affect-${demande.id}`)

      try {
        if (!selectedEffectiveEncadreurId) {
          throw new Error("Selectionnez un encadreur avant de confirmer.")
        }

        await requestAuthJson<AffectationReadDetailed>("/affectation/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            demande_id: demande.id,
            projet_id: projetId,
            encadreur_id: Number(selectedEffectiveEncadreurId),
          }),
        })

        setActionSuccess(`Affectation creee pour la demande #${demande.id}.`)
        await loadDemandes({ silent: true })
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setActionError(asErrorMessage(error, "Creation de l affectation impossible pour le moment."))
      } finally {
        setActionLoadingKey(null)
      }
    },
    [loadDemandes, navigate, selectedEffectiveEncadreurId],
  )

  const runDocumentDownload = useCallback(
    async (documentItem: DemandeDocumentRead) => {
      setActionError("")
      setActionSuccess("")
      setActionLoadingKey(`doc-${documentItem.id}`)

      try {
        const response = await fetch(buildApiUrl(`/documents/download/${documentItem.id}`), {
          headers: buildAuthHeaders(),
        })

        const contentType = response.headers.get("content-type") || ""
        let payload: unknown = null
        if (contentType.includes("application/json")) {
          payload = await response.json()
        } else if (!response.ok) {
          payload = await response.text()
        }

        if (!response.ok) {
          throw new ApiError(
            extractErrorMessage(payload) || `Erreur HTTP ${response.status}`,
            response.status,
            payload,
          )
        }

        const blob = await response.blob()
        const fileName = fileNameFromPath(documentItem.file_path) || `${documentTypeLabel(documentItem.type)}-${documentItem.id}.pdf`
        const fileUrl = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = fileUrl
        anchor.download = fileName
        anchor.click()
        URL.revokeObjectURL(fileUrl)
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setActionError(asErrorMessage(error, "Telechargement du document impossible."))
      } finally {
        setActionLoadingKey(null)
      }
    },
    [navigate],
  )

  const runStatusAction = useCallback(
    async (mode: "accept" | "refuse" | "pending", demandeId: number) => {
      setActionError("")
      setActionSuccess("")
      setActionLoadingKey(`status-${demandeId}-${mode}`)

      try {
        if (mode === "accept") {
          if (!selectedEffectiveEncadreurId) {
            throw new Error("Selectionnez un encadreur avant validation.")
          }
          if (!selectedAffectation) {
            throw new Error("Affectez d abord le projet et l encadreur avant acceptation.")
          }
          await requestAuthJson<{ message: string }>(
            `/projets-stage/${demandeId}/accepter_demande_stage?encadreur_id=${encodeURIComponent(selectedEffectiveEncadreurId)}`,
            { method: "POST" },
          )
          setActionSuccess(`Demande #${demandeId} acceptee.`)
        } else if (mode === "refuse") {
          await requestAuthJson<DemandeStageRead>(`/projets-stage/${demandeId}/refuser`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reason: statusReason.trim() || null,
            }),
          })
          setActionSuccess(`Demande #${demandeId} refusee.`)
        } else {
          await requestAuthJson<DemandeStageRead>(`/projets-stage/${demandeId}/mettre-en-attente`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reason: statusReason.trim() || null,
            }),
          })
          setActionSuccess(`Demande #${demandeId} remise en attente.`)
        }

        setStatusReason("")
        await loadDemandes({ silent: true })
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setActionError(asErrorMessage(error, "Mise a jour du statut impossible pour le moment."))
      } finally {
        setActionLoadingKey(null)
      }
    },
    [loadDemandes, navigate, selectedAffectation, selectedEffectiveEncadreurId, statusReason],
  )

  const exportCsv = useCallback(() => {
    const headers = ["ID", "Nom", "Prenom", "Email", "Telephone", "Niveau", "Departement", "Statut", "DateDepot"]
    const rows = filteredDemandes.map((demande) => [
      String(demande.id),
      demande.nom,
      demande.prenom,
      demande.email,
      demande.telephone,
      demande.niveau_etude,
      demande.departement_souhaite,
      demande.statut,
      demande.created_at,
    ])
    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map((value) => csvEscape(value)).join(",")),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `candidatures-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [filteredDemandes])

  const selectedStatut = toStatusKey(selectedDemande?.statut)
  const isSelectedAccepted = selectedStatut === "ACCEPTEE"
  const isSelectedRefused = selectedStatut === "REFUSEE"
  const canProposeProjects = Boolean(
    selectedDemande &&
      !isSelectedAccepted &&
      !isSelectedRefused &&
      !selectedAffectation &&
      !selectedFlowMeta.chosen &&
      selectedFlowMeta.pendingCount === 0,
  )
  const canCreateAffectation = Boolean(
    selectedDemande &&
      !selectedAffectation &&
      selectedProjectId &&
      selectedEffectiveEncadreurId &&
      !isSelectedAccepted,
  )
  const canAcceptSelected = Boolean(
    selectedDemande &&
      !isSelectedAccepted &&
      selectedAffectation &&
      selectedEffectiveEncadreurId,
  )

  const dashboardKpis = [
    {
      key: "total",
      label: "Total dossiers",
      value: statsSummary.total,
      helper: "Vision globale",
      icon: FileText,
      iconClassName: "bg-slate-900 text-white",
      valueClassName: "text-slate-900",
    },
    {
      key: "pending",
      label: "En attente",
      value: statsSummary.pending,
      helper: "A traiter",
      icon: Clock3,
      iconClassName: "bg-amber-100 text-amber-700",
      valueClassName: "text-amber-700",
    },
    {
      key: "progress",
      label: "En cours",
      value: statsSummary.inProgress,
      helper: "Pipeline actif",
      icon: Sparkles,
      iconClassName: "bg-indigo-100 text-indigo-700",
      valueClassName: "text-indigo-700",
    },
    {
      key: "accepted",
      label: "Acceptees",
      value: statsSummary.accepted,
      helper: "Validees",
      icon: CheckCircle2,
      iconClassName: "bg-emerald-100 text-emerald-700",
      valueClassName: "text-emerald-700",
    },
    {
      key: "refused",
      label: "Refusees",
      value: statsSummary.refused,
      helper: "Cloturees",
      icon: XCircle,
      iconClassName: "bg-rose-100 text-rose-700",
      valueClassName: "text-rose-700",
    },
  ]
  const hasActiveFilters = filterStatus !== "ALL" || Boolean(searchQuery.trim())

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="relative flex flex-col gap-6">
        <div className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-72 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.10),transparent_58%),radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.12),transparent_40%)]" />
        <DashboardPageHeader
          title={
            hasDetailRoute
              ? (selectedDemande ? `Affectation - ${fullName(selectedDemande.prenom, selectedDemande.nom)}` : "Affectation candidature")
              : "Candidatures"
          }
          subtitle={
            hasDetailRoute
              ? "Consultez le dossier, proposez un projet et affectez un encadreur sur une page dediee."
              : "Pilotez le pipeline complet: proposition, choix projet, affectation et validation finale."
          }
          kicker="Operations admin"
          className="rounded-2xl border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm backdrop-blur sm:px-6"
          actions={(
            <div className="flex items-center gap-2">
              {hasDetailRoute && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 border-slate-300 bg-white text-xs"
                  onClick={backToList}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Retour a la liste
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-slate-300 bg-white text-xs"
                onClick={() => void loadDemandes({ silent: true })}
                disabled={isLoading || isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Actualiser
              </Button>
              {!hasDetailRoute && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 border-slate-300 bg-white text-xs"
                  onClick={exportCsv}
                  disabled={isLoading || filteredDemandes.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              )}
            </div>
          )}
        />

        {pageError && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-2.5 text-sm text-red-700 shadow-sm">
            {pageError}
          </div>
        )}

        {sidebarWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-700 shadow-sm">
            {sidebarWarning}
          </div>
        )}

        {dataWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-700 shadow-sm">
            {dataWarning}
          </div>
        )}

        {actionError && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-2.5 text-sm text-red-700 shadow-sm">
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-700 shadow-sm">
            {actionSuccess}
          </div>
        )}

        {!hasDetailRoute && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {dashboardKpis.map((kpi) => (
              <Card key={kpi.key} className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{kpi.label}</p>
                    <p className={`mt-1 text-2xl font-bold leading-none ${kpi.valueClassName}`}>{kpi.value}</p>
                    <p className="mt-2 text-[11px] text-slate-500">{kpi.helper}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconClassName}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className={hasDetailRoute ? "w-full" : "grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]"}>
          <div className={hasDetailRoute ? "hidden" : "xl:col-span-2"}>
            <Card className="overflow-hidden border-slate-200/80 bg-white/90 shadow-sm backdrop-blur">
              <CardHeader className="gap-4 border-b border-slate-100/90 bg-slate-50/70 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900">Liste des candidatures</CardTitle>
                    <CardDescription className="mt-1 text-slate-600">
                      Consultez rapidement les dossiers, appliquez un filtre et ouvrez le detail d une demande.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {filteredDemandes.length} resultat(s)
                    </span>
                    {hasActiveFilters ? (
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                        Filtres actifs
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[240px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Rechercher par nom, email, departement..."
                      className="h-10 border-slate-300/90 bg-white pl-9 text-sm"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>
                  <div className="flex min-w-[190px] items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                      <SelectTrigger className="h-10 w-full border-slate-300/90 bg-white text-xs">
                        <SelectValue placeholder="Tous statuts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tous</SelectItem>
                        <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                        <SelectItem value="EN_COURS">En cours</SelectItem>
                        <SelectItem value="ACCEPTEE">Acceptees</SelectItem>
                        <SelectItem value="REFUSEE">Refusees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {isLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des candidatures...
                  </div>
                ) : pagedDemandes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    Aucune candidature pour ce filtre.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/90">
                          <tr className="border-b border-slate-200">
                            <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Candidat</th>
                            <th className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 md:table-cell">Type</th>
                            <th className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 lg:table-cell">Departement</th>
                            <th className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:table-cell">Depot</th>
                            <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Statut</th>
                            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Ouvrir</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedDemandes.map((demande) => (
                            <tr
                              key={demande.id}
                              className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 ${
                                selectedDemandeId === demande.id ? "bg-indigo-50/70" : "hover:bg-slate-50/80"
                              }`}
                              onClick={() => openDemandeDetails(demande.id)}
                            >
                              <td className="px-3 py-3">
                                <p className="font-medium text-slate-900">{fullName(demande.prenom, demande.nom)}</p>
                                <p className="text-[11px] text-slate-500">{demande.email}</p>
                              </td>
                              <td className="hidden px-3 py-3 text-xs text-slate-600 md:table-cell">
                                {enumToLabel(demande.niveau_etude)}
                              </td>
                              <td className="hidden px-3 py-3 text-xs text-slate-600 lg:table-cell">
                                {enumToLabel(demande.departement_souhaite)}
                              </td>
                              <td className="hidden px-3 py-3 text-xs text-slate-600 sm:table-cell">
                                {formatDate(demande.created_at)}
                              </td>
                              <td className="px-3 py-3">
                                <StatusBadge status={demande.statut} />
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openDemandeDetails(demande.id)
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="text-xs text-slate-600">
                    {filteredDemandes.length} candidature(s) • page {currentPage}/{totalPages}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 border-slate-300 p-0"
                      onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 border-slate-300 p-0"
                      onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {hasDetailRoute && selectedDemande && (
            <Card className="w-full overflow-hidden border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-sky-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg font-semibold text-slate-900">
                      {fullName(selectedDemande.prenom, selectedDemande.nom)}
                    </CardTitle>
                    <CardDescription className="mt-1 text-slate-500">Demande #{selectedDemande.id}</CardDescription>
                  </div>
                  <StatusBadge status={selectedDemande.statut} />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  Recu le {formatDate(selectedDemande.created_at)}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                    <span className="break-all">{selectedDemande.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    <span>{selectedDemande.telephone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-500" />
                    <span>{selectedDemande.etablissement}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>{enumToLabel(selectedDemande.departement_souhaite)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <span>{formatDate(selectedDemande.date_debut_souhaitee)} - {formatDate(selectedDemande.date_fin_souhaitee)}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Documents associes</p>
                    <p className="text-xs text-slate-500">{selectedDemande.documents?.length || 0} fichier(s)</p>
                  </div>
                  {!selectedDemande.documents?.length ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                      Aucun document associe a cette demande.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedDemande.documents.map((documentItem) => (
                        <div key={documentItem.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 transition-colors hover:bg-slate-50">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-slate-500" />
                              <p className="truncate text-xs font-medium text-slate-900">
                                {documentTypeLabel(documentItem.type)} - {fileNameFromPath(documentItem.file_path) || `document-${documentItem.id}.pdf`}
                              </p>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <DocumentStatusBadge status={documentItem.status} />
                              <span className="text-[10px] text-slate-500">#{documentItem.id}</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 border-slate-300 text-[11px]"
                            onClick={() => void runDocumentDownload(documentItem)}
                            disabled={Boolean(actionLoadingKey)}
                          >
                            {actionLoadingKey === `doc-${documentItem.id}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            Ouvrir
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-3.5">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-700" />
                    <p className="text-sm font-semibold text-indigo-900">Workflow de traitement</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full gap-1.5 text-xs"
                      size="sm"
                      variant="outline"
                      onClick={() => void runProposerAction(selectedDemande.id)}
                      disabled={!canProposeProjects || Boolean(actionLoadingKey)}
                    >
                      {actionLoadingKey === `propose-${selectedDemande.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Proposer projets
                    </Button>

                    {selectedFlowMeta.currentCycle.length > 0 && (
                      <div className="rounded-lg border border-indigo-100/80 bg-white px-2.5 py-2">
                        <p className="text-[11px] font-medium text-slate-900">Cycle de proposition</p>
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {selectedFlowMeta.currentCycle.map((proposition) => (
                            <div key={proposition.id} className="flex items-center justify-between gap-2">
                              <p className="truncate pr-2 text-[11px] text-slate-600">
                                {proposition.projet_code} - {proposition.projet_intitule}
                              </p>
                              <PropositionStatusBadge status={proposition.statut} />
                            </div>
                          ))}
                        </div>
                        {selectedFlowMeta.latestExpiration && (
                          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Clock3 className="h-3 w-3" />
                            Expire le {formatDateTime(selectedFlowMeta.latestExpiration)}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border border-indigo-100/80 bg-white px-2.5 py-2">
                      <p className="text-[11px] font-medium text-slate-900">Projet choisi</p>
                      {selectedProjectId ? (
                        <p className="mt-1 text-[11px] text-slate-600">
                          {selectedAffectation?.projet
                            ? `${selectedAffectation.projet.code_projet} - ${selectedAffectation.projet.intitule}`
                            : selectedFlowMeta.chosen
                              ? `${selectedFlowMeta.chosen.projet_code} - ${selectedFlowMeta.chosen.projet_intitule}`
                              : `Projet #${selectedProjectId}`}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-600">
                          En attente du choix du candidat.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Encadreur pour affectation</p>
                  <Select value={selectedEffectiveEncadreurId} onValueChange={setSelectedEncadreurId}>
                    <SelectTrigger className="h-9 w-full border-slate-300 bg-white text-xs" disabled={Boolean(selectedAffectation)}>
                      <SelectValue placeholder="Selectionner un encadreur" />
                    </SelectTrigger>
                    <SelectContent>
                      {encadreurs.map((encadreur) => (
                        <SelectItem key={encadreur.id} value={String(encadreur.id)}>
                          {fullName(encadreur.prenom, encadreur.nom)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAffectation?.encadreur && (
                    <p className="mt-2 text-[11px] text-emerald-700">
                      Encadreur affecte: {fullName(selectedAffectation.encadreur.prenom, selectedAffectation.encadreur.nom)}
                    </p>
                  )}
                  {encadreurs.length === 0 && (
                    <p className="mt-2 text-xs text-amber-700">Aucun encadreur actif disponible pour le moment.</p>
                  )}
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-1.5 border-slate-300 text-xs"
                  size="sm"
                  onClick={() => {
                    if (selectedProjectId) {
                      void runAffectationAction(selectedDemande, selectedProjectId)
                    }
                  }}
                  disabled={!canCreateAffectation || Boolean(actionLoadingKey)}
                >
                  {actionLoadingKey === `affect-${selectedDemande.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5" />
                  )}
                  Affecter encadrant
                </Button>

                {!selectedProjectId && (
                  <p className="text-[11px] text-slate-500">
                    Cette action sera disponible apres choix du projet.
                  </p>
                )}

                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Motif (optionnel)</p>
                  <Textarea
                    value={statusReason}
                    onChange={(event) => setStatusReason(event.target.value)}
                    rows={3}
                    placeholder="Motif de refus ou commentaire interne..."
                    className="border-slate-300 text-xs"
                  />
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
                  <Button
                    className="w-full gap-1.5 text-xs"
                    size="sm"
                    onClick={() => void runStatusAction("accept", selectedDemande.id)}
                    disabled={!canAcceptSelected || Boolean(actionLoadingKey)}
                  >
                    {actionLoadingKey === `status-${selectedDemande.id}-accept`
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Accepter
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full gap-1.5 border-destructive/20 text-xs text-destructive hover:bg-destructive/10"
                    size="sm"
                    onClick={() => void runStatusAction("refuse", selectedDemande.id)}
                    disabled={isSelectedRefused || Boolean(actionLoadingKey)}
                  >
                    {actionLoadingKey === `status-${selectedDemande.id}-refuse`
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <XCircle className="h-3.5 w-3.5" />}
                    Refuser
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full gap-1.5 border-slate-300 text-xs"
                    size="sm"
                    onClick={() => void runStatusAction("pending", selectedDemande.id)}
                    disabled={selectedStatut === "EN_ATTENTE" || Boolean(actionLoadingKey)}
                  >
                    {actionLoadingKey === `status-${selectedDemande.id}-pending`
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <UserCheck className="h-3.5 w-3.5" />}
                    Mettre en attente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {hasDetailRoute && !selectedDemande && (
            <Card className="border-dashed border-slate-300 bg-slate-50/70 shadow-none">
              <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-sm font-medium text-slate-700">Candidature introuvable</p>
                <p className="max-w-xs text-xs text-slate-500">
                  Retournez a la liste puis ouvrez une candidature valide pour afficher le detail et les actions de workflow.
                </p>
                <Button variant="outline" size="sm" className="mt-2" onClick={backToList}>
                  Retour a la liste
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
