import { ArrowRight, CheckCircle2, FileCheck2, Shield, Users2 } from "lucide-react"
import { Link } from "react-router-dom"

const trustHighlights = [
  "Flux de validation multi-role",
  "Historique et tracabilite des decisions",
  "Conforme aux exigences institutionnelles",
]

export function HeroSection() {
  return (
    <section id="plateforme" className="relative overflow-hidden pb-24 pt-32 lg:pb-32 lg:pt-40">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-72 w-72 rounded-full bg-blue-200/35 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/95 px-4 py-2 text-xs font-semibold tracking-wide text-indigo-700 shadow-sm">
            <Shield className="h-3.5 w-3.5" />
            Plateforme officielle de gestion des stages
          </div>

          <h1 className="mt-7 max-w-2xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Pilotez les candidatures de stage avec un cadre fiable et transparent.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Gestion des Stagiaires centralise la reception des demandes, l evaluation des profils et le suivi des
            stagiaires pour les administrations universitaires et les encadreurs.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/connexion"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Acceder a la plateforme
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/candidature"
              className="inline-flex items-center justify-center rounded-lg border border-indigo-100 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Soumettre une candidature
            </Link>
          </div>

          <ul className="mt-8 grid gap-2.5 text-sm text-slate-600 sm:grid-cols-2">
            {trustHighlights.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-indigo-100 bg-white/95 p-5 shadow-xl shadow-indigo-100/60 backdrop-blur">
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-600 to-blue-600 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/80">Vue d ensemble</p>
            <p className="mt-2 text-2xl font-bold">Cycle de traitement des stages</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 p-3">
                <FileCheck2 className="h-4 w-4" />
                <p className="mt-2 text-xs text-white/80">Demandes recues</p>
                <p className="text-lg font-semibold">1 248</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <Users2 className="h-4 w-4" />
                <p className="mt-2 text-xs text-white/80">Stages actifs</p>
                <p className="text-lg font-semibold">312</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <Shield className="h-4 w-4" />
                <p className="mt-2 text-xs text-white/80">SLA traitement</p>
                <p className="text-lg font-semibold">48h</p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
              <span className="text-sm font-medium text-slate-700">Candidatures en attente</span>
              <span className="text-sm font-semibold text-indigo-700">84</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
              <span className="text-sm font-medium text-slate-700">Evaluations a valider</span>
              <span className="text-sm font-semibold text-indigo-700">19</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
              <span className="text-sm font-medium text-slate-700">Taux de dossiers complets</span>
              <span className="text-sm font-semibold text-indigo-700">96%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
