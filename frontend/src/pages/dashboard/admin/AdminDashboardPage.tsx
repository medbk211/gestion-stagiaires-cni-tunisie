import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileCheck2,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Settings,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { DashboardShell, type NavItem } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"

interface CurrentUserResponse {
  id: number
  email: string
  nom: string
  prenom: string
  role: string
}

interface StatutCount {
  statut: string
  count: number
}

interface DepartementCount {
  departement: string
  count: number
}

interface ActiviteItem {
  id: number
  nom: string
  action: string
  statut: string
  created_at: string | null
}

interface DashboardStatsRead {
  totaux: {
    demandes: number
    stagiaires: number
    encadreurs: number
    documents: number
    affectations: number
    projets: number
  }
  demandes_par_statut: StatutCount[]
  affectations_par_statut: StatutCount[]
  projets_par_statut: StatutCount[]
  projets_par_departement: DepartementCount[]
  activite_recente: ActiviteItem[]
}

interface DemandeStageRead {
  id: number
  nom: string
  prenom: string
  niveau_etude: string
  departement_souhaite: string
  statut: string
  created_at: string
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

function findStatusCount(items: StatutCount[], statusKey: string): number {
  const match = items.find((item) => (item.statut || "").toUpperCase() === statusKey.toUpperCase())
  return match?.count || 0
}

function StatusBadge({ status }: { status: string }) {
  const key = (status || "").toUpperCase()
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

export default function AdminDashboardPage() {
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")

  const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null)
  const [stats, setStats] = useState<DashboardStatsRead | null>(null)
  const [recentDemandes, setRecentDemandes] = useState<DemandeStageRead[]>([])

  const loadDashboard = useCallback(
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
        const [meResult, statsResult, demandesResult] = await Promise.allSettled([
          requestAuthJson<CurrentUserResponse>("/auth/me"),
          requestAuthJson<DashboardStatsRead>("/statistiques/dashboard"),
          requestAuthJson<DemandeStageRead[]>("/projets-stage/demandes-stage?limit=6"),
        ] as const)

        if (
          [meResult, statsResult, demandesResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (statsResult.status === "rejected") {
          throw statsResult.reason
        }

        const warnings: string[] = []

        const nextUser = meResult.status === "fulfilled" ? meResult.value : null
        if (meResult.status === "rejected") {
          warnings.push(`Utilisateur: ${asErrorMessage(meResult.reason, "indisponible")}`)
        }

        const nextStats = statsResult.value

        const nextDemandes = demandesResult.status === "fulfilled"
          ? [...demandesResult.value].sort((a, b) => {
              const timeA = parseDate(a.created_at)?.getTime() || 0
              const timeB = parseDate(b.created_at)?.getTime() || 0
              return timeB - timeA
            }).slice(0, 6)
          : []
        if (demandesResult.status === "rejected") {
          warnings.push(`Demandes: ${asErrorMessage(demandesResult.reason, "indisponibles")}`)
        }

        if (nextUser) {
          localStorage.setItem("cni_user_name", `${nextUser.prenom} ${nextUser.nom}`.trim())
          localStorage.setItem("cni_user_email", nextUser.email)
          localStorage.setItem("cni_user_role", nextUser.role)
        }

        setCurrentUser(nextUser)
        setStats(nextStats)
        setRecentDemandes(nextDemandes)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement du dashboard admin impossible pour le moment."))
      } finally {
        if (silent) {
          setIsRefreshing(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [navigate],
  )

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const pendingDemandes = useMemo(
    () => findStatusCount(stats?.demandes_par_statut || [], "EN_ATTENTE"),
    [stats?.demandes_par_statut],
  )

  const navItems = useMemo<NavItem[]>(
    () => [
      { label: "Tableau de bord", href: "/dashboard/admin", icon: LayoutDashboard },
      {
        label: "Candidatures",
        href: "/dashboard/admin/candidatures",
        icon: ClipboardList,
        badge: pendingDemandes > 0 ? String(pendingDemandes) : undefined,
      },
      { label: "Stagiaires", href: "/dashboard/admin/stagiaires", icon: Users },
      { label: "Encadrants", href: "/dashboard/admin/encadrants", icon: UserPlus },
      { label: "Projets", href: "/dashboard/admin/projets", icon: Briefcase },
      { label: "Attestations", href: "/dashboard/admin/attestations", icon: FileCheck2 },
      { label: "Statistiques", href: "/dashboard/admin/stats", icon: BarChart3 },
      { label: "Parametres", href: "/dashboard/admin/settings", icon: Settings },
    ],
    [pendingDemandes],
  )

  const userName = useMemo(() => {
    const fromUser = currentUser ? `${currentUser.prenom} ${currentUser.nom}`.trim() : ""
    if (fromUser) {
      return fromUser
    }
    const fromStorage = localStorage.getItem("cni_user_name") || ""
    return fromStorage.trim() || "Administrateur"
  }, [currentUser])

  const userRole = useMemo(() => {
    const fromRole = enumToLabel(currentUser?.role || localStorage.getItem("cni_user_role"))
    return fromRole !== "-" ? fromRole : "Administrateur"
  }, [currentUser?.role])

  const departmentRows = useMemo(() => {
    const rows = stats?.projets_par_departement || []
    const max = Math.max(1, ...rows.map((row) => row.count))
    return rows.map((row) => ({
      ...row,
      percent: Math.round((row.count / max) * 100),
    }))
  }, [stats?.projets_par_departement])

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title={`Bonjour, ${userName}`}
          subtitle="Vue en temps reel de l activite plateforme."
          actions={(
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => void loadDashboard({ silent: true })}
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

        {dataWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {dataWarning}
          </div>
        )}

        {isLoading ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du dashboard admin...
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total candidatures</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats?.totaux?.demandes || 0}</span>
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stagiaires actifs</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats?.totaux?.stagiaires || 0}</span>
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">En attente</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{pendingDemandes}</span>
                    <FileCheck2 className="h-5 w-5 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Encadrants</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{stats?.totaux?.encadreurs || 0}</span>
                    <Building2 className="h-5 w-5 text-violet-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card className="shadow-sm">
                  <CardHeader className="flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Candidatures recentes</CardTitle>
                      <CardDescription>Dernieres demandes recues depuis le backend.</CardDescription>
                    </div>
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link to="/dashboard/admin/candidatures">Voir tout</Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {recentDemandes.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        Aucune candidature disponible.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Candidat</th>
                              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Type</th>
                              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">Departement</th>
                              <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Statut</th>
                              <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentDemandes.map((demande) => (
                              <tr key={demande.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30">
                                <td className="py-3">
                                  <p className="font-medium text-foreground">{`${demande.prenom} ${demande.nom}`}</p>
                                  <p className="text-xs text-muted-foreground">#{demande.id} · {formatDate(demande.created_at)}</p>
                                </td>
                                <td className="py-3 hidden sm:table-cell text-xs text-muted-foreground">
                                  {enumToLabel(demande.niveau_etude)}
                                </td>
                                <td className="py-3 hidden md:table-cell text-xs text-muted-foreground">
                                  {enumToLabel(demande.departement_souhaite)}
                                </td>
                                <td className="py-3">
                                  <StatusBadge status={demande.statut} />
                                </td>
                                <td className="py-3 text-right">
                                  <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                                    <Link to="/dashboard/admin/candidatures">
                                      <Eye className="h-3 w-3" />
                                      Ouvrir
                                    </Link>
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Projets par departement</CardTitle>
                  <CardDescription>Volume relatif des projets actifs.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {departmentRows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Donnees departement indisponibles.
                    </div>
                  ) : (
                    departmentRows.map((row) => (
                      <div key={row.departement} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{enumToLabel(row.departement)}</span>
                          <span className="text-xs text-muted-foreground">{row.count}</span>
                        </div>
                        <Progress value={row.percent} className="h-2" />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="cursor-pointer shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="rounded-xl bg-amber-100 p-3">
                    <FileCheck2 className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Validation candidatures</p>
                    <p className="text-xs text-muted-foreground">{pendingDemandes} en attente</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="rounded-xl bg-blue-100 p-3">
                    <UserPlus className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Affectations</p>
                    <p className="text-xs text-muted-foreground">{stats?.totaux?.affectations || 0} total</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="rounded-xl bg-emerald-100 p-3">
                    <Download className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Documents</p>
                    <p className="text-xs text-muted-foreground">{stats?.totaux?.documents || 0} fichiers</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {stats?.activite_recente?.length ? (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Activite recente</CardTitle>
                  <CardDescription>Flux backend des dernieres actions.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {stats.activite_recente.slice(0, 6).map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{activity.nom}</p>
                        <p className="text-xs text-muted-foreground">{activity.action}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-[10px]">{enumToLabel(activity.statut)}</Badge>
                        <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(activity.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{stats?.totaux?.projets || 0} projets</p>
                    <p className="text-xs text-muted-foreground">Tous statuts confondus</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{findStatusCount(stats?.projets_par_statut || [], "AFFECTE")} projets affectes</p>
                    <p className="text-xs text-muted-foreground">En execution</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="rounded-xl bg-violet-100 p-2 text-violet-700">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{findStatusCount(stats?.affectations_par_statut || [], "ACCEPTEE")} affectations acceptees</p>
                    <p className="text-xs text-muted-foreground">Selon les statistiques</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
