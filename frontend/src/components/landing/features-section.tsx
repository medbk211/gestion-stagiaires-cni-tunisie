import { BookUser, CheckCircle2, ClipboardList, GraduationCap, LineChart, Shield } from "lucide-react"

const spaces = [
  {
    title: "Espace Administrateur",
    description: "Pilotage global des demandes, affectation des dossiers et supervision des indicateurs de performance.",
    icon: <BookUser className="h-5 w-5" />,
    points: ["Validation centralisee", "Tableaux de bord executifs", "Export et reporting"],
  },
  {
    title: "Espace Encadrant",
    description: "Suivi des stagiaires, evaluation progressive et communication structuree avec les equipes.",
    icon: <ClipboardList className="h-5 w-5" />,
    points: ["Avis motive sur les candidatures", "Planification des evaluations", "Suivi des livrables"],
  },
  {
    title: "Espace Stagiaire",
    description: "Depot de candidature, consultation de l avancement et gestion des documents de stage.",
    icon: <GraduationCap className="h-5 w-5" />,
    points: ["Statut en temps reel", "Messagerie avec encadreur", "Journal et documents"],
  },
]

const guarantees = [
  { label: "Securite des donnees", detail: "Controle d acces et historique d actions", icon: <Shield className="h-4 w-4" /> },
  { label: "Qualite de service", detail: "Suivi des delais et des indicateurs", icon: <LineChart className="h-4 w-4" /> },
  { label: "Conformite processus", detail: "Workflow normalise et auditable", icon: <CheckCircle2 className="h-4 w-4" /> },
]

export function FeaturesSection() {
  return (
    <section id="espaces" className="mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-700">Experiences par role</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Des interfaces dediees a chaque acteur du stage
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          La plateforme fournit des parcours adaptes aux besoins de gouvernance, d encadrement et de suivi etudiant.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {spaces.map((space) => (
          <article
            key={space.title}
            className="group rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-100/50"
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 transition-transform group-hover:scale-105">
              {space.icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{space.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{space.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {space.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-8 grid gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-6 sm:grid-cols-3">
        {guarantees.map((item) => (
          <div key={item.label} className="rounded-xl border border-indigo-100 bg-white p-4">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              {item.icon}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{item.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
