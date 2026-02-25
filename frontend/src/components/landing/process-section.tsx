import { ArrowRight, ClipboardCheck, FileSearch, FolderCheck, UserCheck } from "lucide-react"

const steps = [
  {
    step: "01",
    title: "Depot de la demande",
    description: "Le stagiaire soumet son dossier avec les pieces requises et ses preferences de stage.",
    icon: <FileSearch className="h-4 w-4" />,
  },
  {
    step: "02",
    title: "Qualification administrative",
    description: "L administrateur verifie la conformite du dossier et assigne les candidatures aux encadreurs.",
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
  {
    step: "03",
    title: "Evaluation pedagogique",
    description: "L encadrant analyse le profil, renseigne son avis et propose une decision motivee.",
    icon: <UserCheck className="h-4 w-4" />,
  },
  {
    step: "04",
    title: "Validation finale",
    description: "La validation institutionnelle est historisee puis communiquee avec un suivi continu du stage.",
    icon: <FolderCheck className="h-4 w-4" />,
  },
]

export function ProcessSection() {
  return (
    <section id="workflow" className="border-y border-indigo-100 bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-700">Processus unifie</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Un workflow clair de la candidature a l integration
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Chaque etape est tracee, attribuee et monitorable pour garantir une gestion transparente entre
            administration, encadrement et etudiants.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {steps.map((item, index) => (
            <article
              key={item.step}
              className="group rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-100/50"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold tracking-[0.18em] text-indigo-500">ETAPE {item.step}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                  Etape suivante
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
