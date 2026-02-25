import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ApiError, clearAuthSession, requestAuthJson } from "@/lib/api"
import { useAdminSidebar } from "@/hooks/use-admin-sidebar"

interface StatutCount {
  statut: string
  count: number
}

interface DepartementCount {
  departement: string
  count: number
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
}

interface DemandeStageRead {
  id: number
  niveau_etude: string
  departement_souhaite: string
  statut: string
  created_at: string
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
})

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const source = value.includes("T") ? value : `${value}T00:00:00`
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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

function findStatusCount(items: StatutCount[], key: string): number {
  const match = items.find((item) => (item.statut || "").toUpperCase() === key.toUpperCase())
  return match?.count || 0
}

function buildLastMonths(count: number): Array<{ key: string; label: string }> {
  const rows: Array<{ key: string; label: string }> = []
  const now = new Date()

  for (let index = count - 1; index >= 0; index -= 1) {
    const current = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`
    const label = MONTH_LABEL_FORMATTER.format(current).replace(/\.$/, "")
    rows.push({ key, label })
  }

  return rows
}

function toMonthKey(value: string | null | undefined): string | null {
  const parsed = parseDate(value)
  if (!parsed) {
    return null
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

export default function AdminStatsPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useAdminSidebar()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [stats, setStats] = useState<DashboardStatsRead | null>(null)
  const [demandes, setDemandes] = useState<DemandeStageRead[]>([])

  const loadStats = useCallback(
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
        const [statsResult, demandesResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<DashboardStatsRead>("/statistiques/dashboard"),
          requestAuthJson<DemandeStageRead[]>("/projets-stage/demandes-stage?limit=400"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [statsResult, demandesResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (statsResult.status === "rejected") {
          throw statsResult.reason
        }

        const warnings: string[] = []

        const nextDemandes = demandesResult.status === "fulfilled"
          ? [...demandesResult.value].sort((a, b) => {
              const timeA = parseDate(a.created_at)?.getTime() || 0
              const timeB = parseDate(b.created_at)?.getTime() || 0
              return timeB - timeA
            })
          : []

        if (demandesResult.status === "rejected") {
          warnings.push(`Demandes: ${asErrorMessage(demandesResult.reason, "indisponibles")}`)
        }

        if (sidebarResult.status === "rejected") {
          warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        setStats(statsResult.value)
        setDemandes(nextDemandes)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement des statistiques impossible pour le moment."))
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
    void loadStats()
  }, [loadStats])

  const totalDemandes = stats?.totaux?.demandes ?? demandes.length
  const pendingDemandes = findStatusCount(stats?.demandes_par_statut || [], "EN_ATTENTE")
  const acceptedDemandes = findStatusCount(stats?.demandes_par_statut || [], "ACCEPTEE")
  const projectsAssigned = findStatusCount(stats?.projets_par_statut || [], "AFFECTE")

  const acceptanceRate = useMemo(() => {
    if (!totalDemandes) {
      return 0
    }
    return clampPercent((acceptedDemandes / totalDemandes) * 100)
  }, [acceptedDemandes, totalDemandes])

  const monthlyRows = useMemo(() => {
    const months = buildLastMonths(6)
    if (demandes.length === 0) {
      return months.map((month) => ({ ...month, candidatures: 0, acceptees: 0 }))
    }

    const byMonth = new Map<string, { candidatures: number; acceptees: number }>()
    for (const demande of demandes) {
      const key = toMonthKey(demande.created_at)
      if (!key) {
        continue
      }
      const current = byMonth.get(key) || { candidatures: 0, acceptees: 0 }
      current.candidatures += 1
      if ((demande.statut || "").toUpperCase() === "ACCEPTEE") {
        current.acceptees += 1
      }
      byMonth.set(key, current)
    }

    return months.map((month) => {
      const values = byMonth.get(month.key) || { candidatures: 0, acceptees: 0 }
      return {
        ...month,
        candidatures: values.candidatures,
        acceptees: values.acceptees,
      }
    })
  }, [demandes])

  const maxMonthly = useMemo(
    () => Math.max(1, ...monthlyRows.map((row) => row.candidatures)),
    [monthlyRows],
  )

  const typeRows = useMemo(() => {
    const byType = new Map<string, number>()

    for (const demande of demandes) {
      const key = (demande.niveau_etude || "INCONNU").toUpperCase()
      byType.set(key, (byType.get(key) || 0) + 1)
    }

    const total = Math.max(1, demandes.length)

    return Array.from(byType.entries())
      .map(([type, count]) => ({
        type,
        count,
        percent: clampPercent((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
  }, [demandes])

  const departmentRows = useMemo(() => {
    const rowsByDept = new Map<string, { departement: string; demandes: number; projets: number }>()

    for (const departementRow of stats?.projets_par_departement || []) {
      const key = (departementRow.departement || "INCONNU").toUpperCase()
      rowsByDept.set(key, {
        departement: key,
        demandes: rowsByDept.get(key)?.demandes || 0,
        projets: departementRow.count || 0,
      })
    }

    for (const demande of demandes) {
      const key = (demande.departement_souhaite || "INCONNU").toUpperCase()
      const current = rowsByDept.get(key) || { departement: key, demandes: 0, projets: 0 }
      current.demandes += 1
      rowsByDept.set(key, current)
    }

    return Array.from(rowsByDept.values())
      .map((row) => ({
        ...row,
        coverage: row.demandes > 0 ? clampPercent((row.projets / row.demandes) * 100) : 0,
      }))
      .sort((a, b) => b.demandes - a.demandes)
  }, [demandes, stats?.projets_par_departement])

  const exportReport = useCallback(() => {
    const payload = {
      generated_at: new Date().toISOString(),
      kpi: {
        total_demandes: totalDemandes,
        en_attente: pendingDemandes,
        acceptees: acceptedDemandes,
        taux_acceptation: acceptanceRate,
      },
      stats,
      monthly_rows: monthlyRows,
      type_rows: typeRows,
      department_rows: departmentRows,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `admin-stats-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [acceptedDemandes, acceptanceRate, departmentRows, monthlyRows, pendingDemandes, stats, totalDemandes, typeRows])

  return (
    <DashboardShell role="admin" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Statistiques"
          subtitle="Vue analytique alimentee par les donnees backend"
          actions={(
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={() => void loadStats({ silent: true })}
                disabled={isLoading || isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Actualiser
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs"
                onClick={exportReport}
                disabled={isLoading || !stats}
              >
                <Download className="h-3.5 w-3.5" />
                Export JSON
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

        {isLoading ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des statistiques...
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total candidatures</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{totalDemandes}</span>
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">En attente</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{pendingDemandes}</span>
                    <BarChart3 className="h-5 w-5 text-amber-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Taux acceptation</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{acceptanceRate}%</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Projets affectes</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{projectsAssigned}</span>
                    <BarChart3 className="h-5 w-5 text-violet-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Candidatures mensuelles</CardTitle>
                  <CardDescription>6 derniers mois depuis /projets-stage/demandes-stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-48 items-end gap-3">
                    {monthlyRows.map((row) => (
                      <div key={row.key} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex w-full flex-1 items-end justify-center gap-1">
                          <div
                            className="w-4 rounded-t bg-indigo-200"
                            style={{ height: `${(row.acceptees / maxMonthly) * 100}%` }}
                            title={`Acceptees: ${row.acceptees}`}
                          />
                          <div
                            className="w-4 rounded-t bg-indigo-600"
                            style={{ height: `${(row.candidatures / maxMonthly) * 100}%` }}
                            title={`Total: ${row.candidatures}`}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />
                      Candidatures
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-indigo-200" />
                      Acceptees
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Repartition par type</CardTitle>
                  <CardDescription>Types de stage reels issus des demandes</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {typeRows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      Aucun type de candidature disponible.
                    </div>
                  ) : (
                    typeRows.map((row) => (
                      <div key={row.type} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{enumToLabel(row.type)}</span>
                          <span className="text-xs text-muted-foreground">{row.count} ({row.percent}%)</span>
                        </div>
                        <Progress value={row.percent} className="h-2.5" />
                      </div>
                    ))
                  )}
                  <div className="border-t border-border pt-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      Total: <span className="font-semibold text-foreground">{demandes.length}</span> demandes
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Performance par departement</CardTitle>
                <CardDescription>Comparaison demandes vs projets actifs</CardDescription>
              </CardHeader>
              <CardContent>
                {departmentRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    Donnees departement indisponibles.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Departement</th>
                          <th className="pb-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Demandes</th>
                          <th className="pb-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Projets</th>
                          <th className="min-w-[170px] pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Couverture</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentRows.map((row) => (
                          <tr key={row.departement} className="border-b border-border/50 last:border-0">
                            <td className="py-3 font-medium text-foreground">{enumToLabel(row.departement)}</td>
                            <td className="py-3 text-center text-muted-foreground">{row.demandes}</td>
                            <td className="py-3 text-center text-muted-foreground">{row.projets}</td>
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                <Progress value={row.coverage} className="h-2 flex-1" />
                                <span className="w-10 text-right text-xs font-medium text-foreground">{row.coverage}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  )
}
