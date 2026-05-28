import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError, authApi } from "@/api";

type BackendRole = "ADMIN" | "ENCADREUR" | "STAGIAIRE";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface CurrentUserResponse {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: string;
}

interface ForgotPasswordResponse {
  message: string;
}

interface LoginFieldErrors {
  email?: string;
  password?: string;
}

const ROLE_ROUTE_SEGMENTS: Record<BackendRole, "admin" | "encadrant" | "stagiaire"> = {
  ADMIN: "admin",
  ENCADREUR: "encadrant",
  STAGIAIRE: "stagiaire",
};

function normalizeBackendRole(role: string | null | undefined): BackendRole | null {
  const normalized = (role || "").trim().toUpperCase();
  if (["ADMIN", "ENCADREUR", "STAGIAIRE"].includes(normalized)) return normalized as BackendRole;
  return null;
}

function getRoleFromAccessToken(accessToken: string): string | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64Payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(paddedPayload)) as { role?: unknown };
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

export default function ConnexionPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotPasswordFeedback, setForgotPasswordFeedback] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("stages_remember_email");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  function validateEmail(value: string) {
    if (!value) return "L'adresse email est obligatoire.";
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) return "Adresse email invalide.";
    return undefined;
  }

  function validatePassword(value: string) {
    if (!value) return "Le mot de passe est obligatoire.";
    if (value.length < 6) return "Le mot de passe doit contenir au moins 6 caractÃ¨res.";
    return undefined;
  }

  function validateLoginFields(nextEmail: string, nextPassword: string): LoginFieldErrors {
    return { email: validateEmail(nextEmail), password: validatePassword(nextPassword) };
  }

  function updateFieldError(field: keyof LoginFieldErrors, value: string) {
    const nextError = field === "email" ? validateEmail(value) : validatePassword(value);
    setFieldErrors((prev) => ({ ...prev, [field]: nextError }));
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const nextFieldErrors = validateLoginFields(normalizedEmail, password);
    setFieldErrors(nextFieldErrors);

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setError("VÃ©rifiez les informations saisies.");
      return;
    }

    setError("");
    setForgotPasswordError("");
    setForgotPasswordFeedback("");
    setIsLoading(true);

    try {
      const session = await authApi.login<LoginResponse>({
        username: normalizedEmail,
        password,
      });

      let currentUser: CurrentUserResponse | null = null;
      try {
        currentUser = await authApi.me<CurrentUserResponse>(session.access_token);
      } catch {
        currentUser = null;
      }

      const backendRole =
        normalizeBackendRole(currentUser?.role || getRoleFromAccessToken(session.access_token));

      if (!backendRole) throw new Error("Role utilisateur introuvable. Contactez l'administrateur.");

      localStorage.setItem("stages_access_token", session.access_token);
      localStorage.setItem("stages_refresh_token", session.refresh_token);
      localStorage.setItem("stages_token_type", session.token_type);
      localStorage.setItem("stages_user_role_backend", backendRole);
      localStorage.setItem("stages_user_role", ROLE_ROUTE_SEGMENTS[backendRole]);
      localStorage.setItem("stages_user_email", currentUser?.email || normalizedEmail);
      localStorage.setItem(
        "stages_user_name",
        `${currentUser?.prenom || ""} ${currentUser?.nom || ""}`.trim()
      );
      if (rememberMe) localStorage.setItem("stages_remember_email", normalizedEmail);
      else localStorage.removeItem("stages_remember_email");

      navigate(`/dashboard/${ROLE_ROUTE_SEGMENTS[backendRole]}`);
    } catch (err) {
      localStorage.clear();
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("Connexion impossible pour le moment. RÃ©essayez plus tard.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword() {
    setForgotPasswordError("");
    setForgotPasswordFeedback("");

    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setFieldErrors((prev) => ({ ...prev, email: emailError }));
      setForgotPasswordError(
        "Saisissez une adresse email valide pour rÃ©initialiser le mot de passe."
      );
      return;
    }

    try {
      setIsForgotPasswordLoading(true);
      const response = await authApi.forgotPassword<ForgotPasswordResponse>({
        email: normalizedEmail,
      });
      setForgotPasswordFeedback(
        response.message || "Si votre compte existe, un email de rÃ©initialisation a Ã©tÃ© envoyÃ©."
      );
    } catch (err) {
      if (err instanceof ApiError) setForgotPasswordError(err.message);
      else setForgotPasswordError("Impossible d'envoyer la demande de rÃ©initialisation.");
    } finally {
      setIsForgotPasswordLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/80 via-white to-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour Ã  l'accueil
        </Link>

        <Card className="border-indigo-100 bg-white/95 shadow-xl shadow-indigo-100/60">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-2xl text-slate-900">Connexion</CardTitle>
            <CardDescription className="text-slate-600">
              Entrez vos identifiants pour accÃ©der Ã  votre tableau de bord.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  Adresse email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setEmail(nextValue);
                      if (fieldErrors.email) updateFieldError("email", nextValue.trim().toLowerCase());
                    }}
                    onBlur={(e) => updateFieldError("email", e.target.value.trim().toLowerCase())}
                    placeholder="prenom.nom@entreprise.com"
                    className={`h-11 pl-10 focus-visible:ring-2 ${
                      fieldErrors.email
                        ? "border-red-400 focus-visible:ring-red-400/50"
                        : "border-indigo-100 focus-visible:ring-indigo-500/40"
                    }`}
                    aria-invalid={fieldErrors.email ? true : undefined}
                    required
                  />
                </div>
                {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setPassword(nextValue);
                      if (fieldErrors.password) updateFieldError("password", nextValue);
                    }}
                    onBlur={(e) => updateFieldError("password", e.target.value)}
                    placeholder="Votre mot de passe"
                    className={`h-11 pl-10 pr-10 focus-visible:ring-2 ${
                      fieldErrors.password
                        ? "border-red-400 focus-visible:ring-red-400/50"
                        : "border-indigo-100 focus-visible:ring-indigo-500/40"
                    }`}
                    aria-invalid={fieldErrors.password ? true : undefined}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                
                
                </div>
                {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
              </div>

              <div className="flex items-center justify-between gap-4">
                <label htmlFor="rememberMe" className="flex items-center gap-2 text-sm text-slate-600">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  Se souvenir de moi
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-indigo-700 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isForgotPasswordLoading}
                >
                  {isForgotPasswordLoading ? "Envoi..." : "Mot de passe oubliÃ© ?"}
                </button>
              </div>

              {forgotPasswordError && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700" role="alert">
                  <AlertCircle className="h-4 w-4" /> {forgotPasswordError}
                </div>
              )}

              {forgotPasswordFeedback && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <CheckCircle className="h-4 w-4" /> {forgotPasswordFeedback}
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full bg-indigo-600 font-semibold text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" /> Connexion en cours...
                  </span>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-600">
          Vous n'avez pas encore de compte ?{" "}
          <Link to="/candidature" className="font-semibold text-indigo-700 hover:text-indigo-800">
            DÃ©poser une candidature
          </Link>
        </p>
      </div>
    </div>
  );
}
