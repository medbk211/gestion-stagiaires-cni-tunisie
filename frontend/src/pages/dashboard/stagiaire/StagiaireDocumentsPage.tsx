import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Download,
  Eye,
  File,
  FileCode,
  FileImage,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  UploadCloud,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ApiError,
  buildApiUrl,
  buildAuthHeaders,
  clearAuthSession,
  extractErrorMessage,
  requestAuthJson,
} from "@/lib/api"
import { useStagiaireSidebar } from "@/hooks/use-stagiaire-sidebar"

interface DocumentRead {
  id: number
  type: string
  file_path: string
  created_at: string
  status: string
  review_comment: string | null
  reviewed_by: number | null
  reviewed_at: string | null
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

function getFileName(path: string, fallback: string): string {
  const normalized = (path || "").replace(/\\/g, "/")
  const name = normalized.split("/").filter(Boolean).pop()
  return name || fallback
}

function normalizeDocType(value: string | null | undefined): string {
  return (value || "").toUpperCase()
}

function guessFileCategory(document: DocumentRead): "pdf" | "image" | "code" | "file" {
  const type = normalizeDocType(document.type)
  if (type.includes("CV") || type.includes("LETTRE") || type.includes("RAPPORT") || type.includes("ATTESTATION") || type.includes("CONVOCATION")) {
    return "pdf"
  }
  const name = getFileName(document.file_path, "").toLowerCase()
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(name)) {
    return "image"
  }
  if (/\.(zip|rar|7z|sql|py|js|ts|tsx|jsx|java|cs|cpp|c|go|rs)$/.test(name)) {
    return "code"
  }
  return "file"
}

function FileIcon({ document }: { document: DocumentRead }) {
  const category = guessFileCategory(document)
  const meta =
    category === "pdf"
      ? { Icon: FileText, className: "bg-red-100 text-red-700" }
      : category === "image"
        ? { Icon: FileImage, className: "bg-amber-100 text-amber-700" }
        : category === "code"
          ? { Icon: FileCode, className: "bg-emerald-100 text-emerald-700" }
          : { Icon: File, className: "bg-slate-100 text-slate-700" }

  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.className}`}>
      <meta.Icon className="h-4 w-4" />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const key = (status || "").toLowerCase()
  const meta =
    key === "validated" || key === "valide" || key === "approved"
      ? { label: "Valide", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : key === "rejected" || key === "refuse" || key === "refused"
        ? { label: "Refuse", className: "border-red-200 bg-red-50 text-red-700" }
        : key === "in_review" || key === "review" || key === "en_revue"
          ? { label: "En revue", className: "border-indigo-200 bg-indigo-50 text-indigo-700" }
          : { label: "En attente", className: "border-amber-200 bg-amber-50 text-amber-700" }

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function StagiaireDocumentsPage() {
  const navigate = useNavigate()
  const { navItems, userName, userRole, sidebarWarning, refreshSidebar } = useStagiaireSidebar()
  const reportInputRef = useRef<HTMLInputElement | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeActionKey, setActiveActionKey] = useState("")
  const [pageError, setPageError] = useState("")
  const [dataWarning, setDataWarning] = useState("")
  const [actionError, setActionError] = useState("")
  const [actionSuccess, setActionSuccess] = useState("")
  const [documents, setDocuments] = useState<DocumentRead[]>([])

  const loadDocuments = useCallback(
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
        const [documentsResult, sidebarResult] = await Promise.allSettled([
          requestAuthJson<DocumentRead[]>("/documents/me?limit=300"),
          refreshSidebar({ silent: true }),
        ] as const)

        if (
          [documentsResult, sidebarResult].some(
            (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401),
          )
        ) {
          throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, null)
        }

        if (documentsResult.status === "rejected") {
          throw documentsResult.reason
        }

        const warnings: string[] = []
        if (sidebarResult.status === "rejected") {
          warnings.push(`Menu: ${asErrorMessage(sidebarResult.reason, "indisponible")}`)
        }

        const nextDocuments = [...documentsResult.value].sort((a, b) => {
          const timeA = parseDate(a.created_at)?.getTime() || 0
          const timeB = parseDate(b.created_at)?.getTime() || 0
          return timeB - timeA
        })

        setDocuments(nextDocuments)
        setDataWarning(warnings[0] || "")
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setPageError(asErrorMessage(error, "Chargement des documents impossible pour le moment."))
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
    void loadDocuments()
  }, [loadDocuments])

  const fetchDocumentBlob = useCallback(async (documentId: number): Promise<Blob> => {
    const response = await fetch(buildApiUrl(`/documents/download/${documentId}`), {
      method: "GET",
      headers: buildAuthHeaders(),
    })

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || ""
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text()

      if (response.status === 401) {
        throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, payload)
      }

      throw new ApiError(
        extractErrorMessage(payload) || `Erreur HTTP ${response.status}`,
        response.status,
        payload,
      )
    }

    return response.blob()
  }, [])

  const downloadDocument = useCallback(
    async (doc: DocumentRead, actionKeyOverride?: string) => {
      setActionError("")
      const actionKey = actionKeyOverride || `download-${doc.id}`
      setActiveActionKey(actionKey)

      try {
        const blob = await fetchDocumentBlob(doc.id)
        const url = URL.createObjectURL(blob)
        const anchor = window.document.createElement("a")
        anchor.href = url
        anchor.download = getFileName(doc.file_path, `document-${doc.id}.pdf`)
        anchor.click()
        URL.revokeObjectURL(url)
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setActionError(asErrorMessage(error, "Telechargement impossible pour ce document."))
      } finally {
        setActiveActionKey("")
      }
    },
    [fetchDocumentBlob, navigate],
  )

  const previewDocument = useCallback(
    async (doc: DocumentRead) => {
      setActionError("")
      const actionKey = `preview-${doc.id}`
      setActiveActionKey(actionKey)

      try {
        const blob = await fetchDocumentBlob(doc.id)
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank", "noopener,noreferrer")
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setActionError(asErrorMessage(error, "Apercu impossible pour ce document."))
      } finally {
        setActiveActionKey("")
      }
    },
    [fetchDocumentBlob, navigate],
  )

  const uploadRapport = useCallback(
    async (file: File) => {
      setActionError("")
      setActionSuccess("")
      setActiveActionKey("upload-rapport")

      try {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          throw new Error("Le rapport doit etre au format PDF.")
        }

        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch(buildApiUrl("/documents/me/upload-rapport"), {
          method: "POST",
          headers: buildAuthHeaders(),
          body: formData,
        })

        const contentType = response.headers.get("content-type") || ""
        const payload = contentType.includes("application/json")
          ? await response.json()
          : await response.text()

        if (!response.ok) {
          if (response.status === 401) {
            throw new ApiError("Session expiree. Veuillez vous reconnecter.", 401, payload)
          }
          throw new ApiError(
            extractErrorMessage(payload) || `Erreur HTTP ${response.status}`,
            response.status,
            payload,
          )
        }

        setActionSuccess("Rapport televerse avec succes.")
        await loadDocuments({ silent: true })
      } catch (error) {
        if (isApiErrorStatus(error, 401)) {
          clearAuthSession()
          navigate("/connexion", { replace: true })
          return
        }
        setActionError(asErrorMessage(error, "Upload rapport impossible pour le moment."))
      } finally {
        setActiveActionKey("")
      }
    },
    [loadDocuments, navigate],
  )

  const conventionDoc = useMemo(
    () => documents.find((doc) => normalizeDocType(doc.type).includes("CONVOCATION")) || null,
    [documents],
  )

  const attestationDoc = useMemo(
    () => documents.find((doc) => normalizeDocType(doc.type).includes("ATTESTATION")) || null,
    [documents],
  )

  const personalFiles = useMemo(
    () =>
      documents.filter((doc) => {
        const type = normalizeDocType(doc.type)
        return !type.includes("CONVOCATION") && !type.includes("ATTESTATION")
      }),
    [documents],
  )

  return (
    <DashboardShell role="stagiaire" navItems={navItems} userName={userName} userRole={userRole}>
      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          title="Documents"
          subtitle="رفع rapport / تحميل convention / تحميل attestation / fichiers personnels"
          actions={(
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => void loadDocuments({ silent: true })}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Actualiser
            </Button>
          )}
        />

        <input
          ref={reportInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              void uploadRapport(file)
            }
            event.currentTarget.value = ""
          }}
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

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">رفع rapport</CardTitle>
              <CardDescription>Televerser votre rapport final (PDF)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full gap-1.5 text-xs"
                onClick={() => reportInputRef.current?.click()}
                disabled={Boolean(activeActionKey)}
              >
                {activeActionKey === "upload-rapport" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                Upload rapport
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">تحميل convention</CardTitle>
              <CardDescription>
                {conventionDoc ? `Disponible depuis ${formatDate(conventionDoc.created_at)}` : "Convention non disponible"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full gap-1.5 text-xs"
                onClick={() => conventionDoc && void downloadDocument(conventionDoc, "download-convention")}
                disabled={!conventionDoc || Boolean(activeActionKey)}
              >
                {activeActionKey === "download-convention" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Telecharger convention
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">تحميل attestation</CardTitle>
              <CardDescription>
                {attestationDoc ? `Disponible depuis ${formatDate(attestationDoc.created_at)}` : "Attestation non disponible"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full gap-1.5 text-xs"
                onClick={() => attestationDoc && void downloadDocument(attestationDoc, "download-attestation")}
                disabled={!attestationDoc || Boolean(activeActionKey)}
              >
                {activeActionKey === "download-attestation" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Telecharger attestation
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Fichiers personnels</CardTitle>
            <CardDescription>{personalFiles.length} fichier(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des fichiers...
              </div>
            ) : personalFiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Aucun fichier personnel disponible.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {personalFiles.map((doc) => {
                  const previewKey = `preview-${doc.id}`
                  const downloadKey = `download-${doc.id}`
                  return (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/30">
                      <FileIcon document={doc} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{getFileName(doc.file_path, `Document #${doc.id}`)}</p>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{enumToLabel(doc.type)}</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                        {doc.review_comment && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">{doc.review_comment}</p>
                        )}
                      </div>
                      <StatusBadge status={doc.status} />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => void previewDocument(doc)}
                          disabled={Boolean(activeActionKey)}
                        >
                          {activeActionKey === previewKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => void downloadDocument(doc)}
                          disabled={Boolean(activeActionKey)}
                        >
                          {activeActionKey === downloadKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Contact support</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              En cas de document manquant: support.cni@cni.tn
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
