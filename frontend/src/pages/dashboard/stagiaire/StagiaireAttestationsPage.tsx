import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileText, Loader2, RefreshCw } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ApiError, attestationsApi, authApi, clearAuthSession } from "@/api"

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

interface CurrentUserResponse {
  id: number
  email: string
  nom: string
  prenom: string
  role: string
}

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

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
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

function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function enumToLabel(value: string | null | undefined): string {
  if (!value) return "-"
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function StagiaireAttestationsPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null)
  const [attestations, setAttestations] = useState<AttestationRead[]>([])

  const navItems = useMemo<NavItem[]>(
    () => [
      { label: "Tableau de bord", href: "/dashboard/stagiaire", icon: FileText },
      { label: "Mon stage", href: "/dashboard/stagiaire/stage", icon: FileText },
      { label: "Tâches", href: "/dashboard/stagiaire/taches", icon: FileText },
      { label: "Documents", href: "/dashboard/stagiaire/documents", icon: FileText },
      { label: "Planning", href: "/dashboard/stagiaire/planning", icon: FileText },
      { label: "Journal", href: "/dashboard/stagiaire/journal", icon: FileText },
      { label: "Messages", href: "/dashboard/stagiaire/messages", icon: FileText },
      { label: "Attestations", href: "/dashboard/stagiaire/attestations", icon: FileText },
      { label: "Paramètres", href: "/dashboard/stagiaire/settings", icon: FileText },
    ],
    [],
  )

  const userName = useMemo(() => {
    const fromUser = currentUser ? `${currentUser.prenom} ${currentUser.nom}`.trim() : ""
    if (fromUser) {
      return fromUser
    }
    const fromStorage = localStorage.getItem("cni_user_name") || ""
    return fromStorage.trim() || "Stagiaire"
  }, [currentUser])

  const userRole = useMemo(() => {
    const fromRole = enumToLabel(currentUser?.role || localStorage.getItem("cni_user_role"))
    return fromRole !== "-" ? fromRole : "Stagiaire"
  }, [currentUser?.role])

  const loadData = useCallback(
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
        const [userData, attestationData] = await Promise.all([
          authApi.me<CurrentUserResponse>(),
          attestationsApi.mine<AttestationRead[]>(),
        ])

        setCurrentUser(userData)
        setAttestations(attestationData)
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

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleDownload = useCallback(
    async (id: number, numero: string) => {
      setPageError("")
      setDownloadingId(id)

      try {
        const blob = await attestationsApi.download(id)
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `${numero}.pdf`
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Impossible de telecharger l'attestation"))
      } finally {
        setDownloadingId((current) => (current === id ? null : current))
      }
    },
    [navigate],
  )

  return (
    <DashboardShell role="stagiaire" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Mes Attestations"
          subtitle="Consulter et télécharger mes attestations de stage"
          actions={(
            <Button
              variant="outline"
              onClick={() => void loadData(true)}
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
          )}
        />

        {pageError && (
          <Card className="border-red-200 bg-red-50/70">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-red-700">{pageError}</p>
              <Button
                variant="outline"
                className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                onClick={() => void loadData()}
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
        ) : attestations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
              Aucune attestation disponible
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {attestations.map((attestation) => (
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
                      <p className="text-xs font-medium text-muted-foreground">Période</p>
                      <p className="text-sm text-foreground">
                        {formatDate(attestation.date_debut_stage)} au{" "}
                        {formatDate(attestation.date_fin_stage)}
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
                        onClick={() => void handleDownload(attestation.id, attestation.numero_attestation)}
                        disabled={downloadingId === attestation.id}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Télécharger
                      </Button>
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
