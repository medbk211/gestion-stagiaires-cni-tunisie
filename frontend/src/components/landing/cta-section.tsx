import { ArrowRight, Headset } from "lucide-react"
import { Link } from "react-router-dom"

export function CtaSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 px-8 py-14 text-white sm:px-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-14 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/75">Lancement rapide</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              Lancez un processus de stage structure et immediat
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/85 sm:text-base">
              Activez votre espace de gestion, centralisez les candidatures et harmonisez le pilotage entre vos
              equipes administratives et pedagogiques.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              to="/connexion"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 transition-all hover:-translate-y-0.5 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Ouvrir mon espace
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/candidature"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/35 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Headset className="h-4 w-4" />
              Demarrer une candidature
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
