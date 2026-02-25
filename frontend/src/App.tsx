import { lazy, Suspense } from "react"
import { Loader2 } from "lucide-react"
import { Navigate, Route, Routes } from "react-router-dom"

const LandingPage = lazy(() => import("@/pages/LandingPage"))
const CandidaturePage = lazy(() => import("@/pages/CandidaturePage"))
const ConnexionPage = lazy(() => import("@/pages/ConnexionPage"))
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"))
const SelectionProjetPage = lazy(() => import("@/pages/SelectionProjetPage"))

const AdminDashboardPage = lazy(() => import("@/pages/dashboard/admin/AdminDashboardPage"))
const AdminCandidaturesPage = lazy(() => import("@/pages/dashboard/admin/AdminCandidaturesPage"))
const AdminEncadrantsPage = lazy(() => import("@/pages/dashboard/admin/AdminEncadrantsPage"))
const AdminProjectsPage = lazy(() => import("@/pages/dashboard/admin/AdminProjectsPage"))
const AdminProjectDetailsPage = lazy(() => import("@/pages/dashboard/admin/AdminProjectDetailsPage"))
const AdminStagiairesPage = lazy(() => import("@/pages/dashboard/admin/AdminStagiairesPage"))
const AdminStagiaireDetailsPage = lazy(() => import("@/pages/dashboard/admin/AdminStagiaireDetailsPage"))
const AdminStatsPage = lazy(() => import("@/pages/dashboard/admin/AdminStatsPage"))
const AdminSettingsPage = lazy(() => import("@/pages/dashboard/admin/AdminSettingsPage"))

const EncadrantDashboardPage = lazy(() => import("@/pages/dashboard/encadrant/EncadrantDashboardPage"))
const EncadrantStagiairesPage = lazy(() => import("@/pages/dashboard/encadrant/EncadrantStagiairesPage"))
const EncadrantStagiaireDetailsPage = lazy(() => import("@/pages/dashboard/encadrant/EncadrantStagiaireDetailsPage"))
const EncadrantPlanningPage = lazy(() => import("@/pages/dashboard/encadrant/EncadrantPlanningPage"))
const EncadrantMessagesPage = lazy(() => import("@/pages/dashboard/encadrant/EncadrantMessagesPage"))
const EncadrantEvaluationsPage = lazy(() => import("@/pages/dashboard/encadrant/EncadrantEvaluationsPage"))
const EncadrantSettingsPage = lazy(() => import("@/pages/dashboard/encadrant/EncadrantSettingsPage"))

const StagiaireDashboardPage = lazy(() => import("@/pages/dashboard/stagiaire/StagiaireDashboardPage"))
const StagiaireStagePage = lazy(() => import("@/pages/dashboard/stagiaire/StagiaireStagePage"))
const StagiaireTachesKanbanPage = lazy(() => import("@/pages/dashboard/stagiaire/StagiaireTachesKanbanPage"))
const StagiaireDocumentsPage = lazy(() => import("@/pages/dashboard/stagiaire/StagiaireDocumentsPage"))
const StagiaireCalendarPage = lazy(() => import("@/pages/dashboard/stagiaire/StagiaireCalendarPage"))
const StagiaireJournalPage = lazy(() => import("@/pages/dashboard/stagiaire/StagiaireJournalPage"))
const StagiaireMessagesPage = lazy(() => import("@/pages/dashboard/stagiaire/StagiaireMessagesPage"))
const StagiaireSettingsPage = lazy(() => import("@/pages/dashboard/stagiaire/StagiaireSettingsPage"))

function AppRouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement...
      </div>
    </div>
  )
}

export function App() {
  return (
    <Suspense fallback={<AppRouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/candidature" element={<CandidaturePage />} />
        <Route path="/connexion" element={<ConnexionPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/selection-projet" element={<SelectionProjetPage />} />

        <Route path="/dashboard/admin" element={<AdminDashboardPage />} />
        <Route path="/dashboard/admin/candidatures" element={<AdminCandidaturesPage />} />
        <Route path="/dashboard/admin/encadrants" element={<AdminEncadrantsPage />} />
        <Route path="/dashboard/admin/projets" element={<AdminProjectsPage />} />
        <Route path="/dashboard/admin/projets/:projetId" element={<AdminProjectDetailsPage />} />
        <Route path="/dashboard/admin/stagiaires" element={<AdminStagiairesPage />} />
        <Route path="/dashboard/admin/stagiaires/:stagiaireId" element={<AdminStagiaireDetailsPage />} />
        <Route path="/dashboard/admin/stats" element={<AdminStatsPage />} />
        <Route path="/dashboard/admin/settings" element={<AdminSettingsPage />} />

        <Route path="/dashboard/encadrant" element={<EncadrantDashboardPage />} />
        <Route path="/dashboard/encadrant/stagiaires" element={<EncadrantStagiairesPage />} />
        <Route
          path="/dashboard/encadrant/stagiaires/:stagiaireId"
          element={<EncadrantStagiaireDetailsPage />}
        />
        <Route path="/dashboard/encadrant/planning" element={<EncadrantPlanningPage />} />
        <Route path="/dashboard/encadrant/messages" element={<EncadrantMessagesPage />} />
        <Route path="/dashboard/encadrant/evaluations" element={<EncadrantEvaluationsPage />} />
        <Route path="/dashboard/encadrant/settings" element={<EncadrantSettingsPage />} />

        <Route path="/dashboard/stagiaire" element={<StagiaireDashboardPage />} />
        <Route path="/dashboard/stagiaire/stage" element={<StagiaireStagePage />} />
        <Route path="/dashboard/stagiaire/taches" element={<StagiaireTachesKanbanPage />} />
        <Route path="/dashboard/stagiaire/documents" element={<StagiaireDocumentsPage />} />
        <Route path="/dashboard/stagiaire/calendar" element={<StagiaireCalendarPage />} />
        <Route path="/dashboard/stagiaire/journal" element={<StagiaireJournalPage />} />
        <Route path="/dashboard/stagiaire/messages" element={<StagiaireMessagesPage />} />
        <Route path="/dashboard/stagiaire/settings" element={<StagiaireSettingsPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
