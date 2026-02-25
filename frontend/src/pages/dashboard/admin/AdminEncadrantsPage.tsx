import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2,
  Loader2,
  Mail,
  Phone,
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
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useAdminSidebar } from "@/hooks/use-admin-sidebar"

interface EncadreurRead {
  id: number
  nom: string
  prenom: string
  email: string
  matricule: string
  grade: string
  departement: string | null
  actif_encadrement: boolean
  max_stagiaires: number
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

export default function AdminEncadrantsPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useAdminSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [encadreurs, setEncadreurs] = useState<EncadreurRead[]>([])
  const [stagiairesCountByEncadreur, setStagiairesCountByEncadreur] = useState<Record<number, number>>({})

  const loadEncadreurs = useCallback(
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
        const [encadreursResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<EncadreurRead[]>("/encadreur/"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [encadreursResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (encadreursResult.status === "rejected") {
          throw encadreursResult.reason
        }

        const warnings: string[] = []
        const nextEncadreurs = [...encadreursResult.value].sort((a, b) =>
          fullName(a.prenom, a.nom).localeCompare(fullName(b.prenom, b.nom)),
        )

        if (sidebarResult.status === "rejected") {
          warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        const countsResult = await Promise.allSettled(
          nextEncadreurs.map((encadreur) =>
            requestAuthJson<Array<{ id: number }>>(`/encadreur/${encadreur.id}/stagiaires`),
          ),
        )

        const nextCountMap: Record<number, number> = {}
        countsResult.forEach((result, index) => {
          const encadreur = nextEncadreurs[index]
          if (result.status === "fulfilled") {
            nextCountMap[encadreur.id] = result.value.length
            return
          }
          nextCountMap[encadreur.id] = 0
          warnings.push(`Stagiaires ${fullName(encadreur.prenom, encadreur.nom)}: ${asErrorMessage(result.reason, "indisponibles")}`)
        })

        setEncadreurs(nextEncadreurs)
        setStagiairesCountByEncadreur(nextCountMap)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement des encadreurs impossible pour le moment."))
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
    void loadEncadreurs()
  }, [loadEncadreurs])

  const filteredEncadreurs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return encadreurs
    }
    return encadreurs.filter((encadreur) => {
      const searchable = [
        fullName(encadreur.prenom, encadreur.nom),
        encadreur.email,
        encadreur.matricule,
        encadreur.grade,
        encadreur.departement || "",
      ]
        .join(" ")
        .toLowerCase()
      return searchable.includes(query)
    })
  }, [encadreurs, searchQuery])

  const summary = useMemo(() => {
    const total = encadreurs.length
    const active = encadreurs.filter((encadreur) => encadreur.actif_encadrement).length
    const available = encadreurs.filter((encadreur) => {
      const count = stagiairesCountByEncadreur[encadreur.id] || 0
      return encadreur.actif_encadrement && count < Math.max(1, encadreur.max_stagiaires)
    }).length
    const full = encadreurs.filter((encadreur) => {
      const count = stagiairesCountByEncadreur[encadreur.id] || 0
      return count >= Math.max(1, encadreur.max_stagiaires)
    }).length

    return { total, active, available, full }
  }, [encadreurs, stagiairesCountByEncadreur])

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Encadrants"
          subtitle="Gestion des encadrants et capacite d encadrement en temps reel"
          actions={(
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => void loadEncadreurs({ silent: true })}
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
              <p className="text-xs font-medium text-muted-foreground">Actifs</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-700">{summary.active}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Disponibles</p>
              <p className="mt-0.5 text-xl font-bold text-indigo-700">{summary.available}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground">Capacite max atteinte</p>
              <p className="mt-0.5 text-xl font-bold text-amber-700">{summary.full}</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un encadreur..."
            className="h-9 max-w-sm pl-9 text-sm"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        {isLoading ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des encadreurs...
            </CardContent>
          </Card>
        ) : filteredEncadreurs.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Aucun encadreur ne correspond a votre recherche.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredEncadreurs.map((encadreur) => {
              const assignedCount = stagiairesCountByEncadreur[encadreur.id] || 0
              const maxStagiaires = Math.max(1, encadreur.max_stagiaires)
              const capacityPercent = Math.min(100, Math.round((assignedCount / maxStagiaires) * 100))
              const isFull = assignedCount >= maxStagiaires

              return (
                <Card key={encadreur.id} className="shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-4 py-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{fullName(encadreur.prenom, encadreur.nom)}</p>
                        <p className="text-xs text-muted-foreground">{enumToLabel(encadreur.grade)}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          encadreur.actif_encadrement
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {encadreur.actif_encadrement ? "Actif" : "Inactif"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{encadreur.departement ? enumToLabel(encadreur.departement) : "Sans departement"}</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Capacite stagiaires</span>
                        <span className="font-semibold text-foreground">{assignedCount}/{maxStagiaires}</span>
                      </div>
                      <Progress value={capacityPercent} className="h-1.5" />
                    </div>

                    <div className="flex flex-col gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span>{encadreur.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        <span>{assignedCount} stagiaire(s) assigne(s)</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm" className="h-8 flex-1 gap-1 text-xs">
                        <a href={`mailto:${encadreur.email}`}>
                          <Phone className="h-3 w-3" />
                          Contacter
                        </a>
                      </Button>
                      {isFull ? (
                        <Button size="sm" className="h-8 flex-1 text-xs" disabled>
                          Capacite pleine
                        </Button>
                      ) : (
                        <Button asChild size="sm" className="h-8 flex-1 text-xs">
                          <Link to="/dashboard/admin/stagiaires">Voir stagiaires</Link>
                        </Button>
                      )}
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
