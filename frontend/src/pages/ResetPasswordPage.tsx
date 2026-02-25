import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiError, requestJson } from "@/lib/api"

interface ResetPasswordResponse {
  message: string
}

interface FormErrors {
  password?: string
  confirmPassword?: string
}

function validatePassword(value: string): string | undefined {
  if (!value.trim()) {
    return "Le nouveau mot de passe est obligatoire."
  }
  if (value.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caracteres."
  }
  return undefined
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams])

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const hasToken = token.length > 0

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage("")
    setSuccessMessage("")

    if (!hasToken) {
      setErrorMessage("Lien invalide: token de reinitialisation manquant.")
      return
    }

    const nextErrors: FormErrors = {}
    nextErrors.password = validatePassword(password)
    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = "La confirmation du mot de passe est obligatoire."
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Les deux mots de passe ne correspondent pas."
    }

    setErrors(nextErrors)
    if (nextErrors.password || nextErrors.confirmPassword) {
      return
    }

    try {
      setIsSubmitting(true)
      const response = await requestJson<ResetPasswordResponse>("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: password,
        }),
      })

      setSuccessMessage(response.message || "Mot de passe reinitialise avec succes.")
      setPassword("")
      setConfirmPassword("")
      setErrors({})

      window.setTimeout(() => {
        navigate("/connexion", { replace: true })
      }, 1800)
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message)
      } else if (error instanceof Error && error.message) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage("Reinitialisation impossible pour le moment.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50/80 via-white to-slate-50 p-6">
      <div className="w-full max-w-md">
        <Link
          to="/connexion"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour a la connexion
        </Link>

        <Card className="border-indigo-100 bg-white/95 shadow-xl shadow-indigo-100/60">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl text-slate-900">Reinitialiser le mot de passe</CardTitle>
            <CardDescription className="text-slate-600">
              Saisissez un nouveau mot de passe pour securiser votre compte.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!hasToken && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Lien de reinitialisation invalide. Verifiez le lien recu par email.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {successMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      if (errors.password) {
                        setErrors((prev) => ({ ...prev, password: undefined }))
                      }
                    }}
                    className="h-11 border-indigo-100 pl-10 pr-10 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    placeholder="Minimum 8 caracteres"
                    disabled={!hasToken || isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      if (errors.confirmPassword) {
                        setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                      }
                    }}
                    className="h-11 border-indigo-100 pl-10 pr-10 focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    placeholder="Retapez le mot de passe"
                    disabled={!hasToken || isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-indigo-600 font-semibold text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                disabled={!hasToken || isSubmitting}
              >
                {isSubmitting ? "Mise a jour en cours..." : "Mettre a jour le mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
