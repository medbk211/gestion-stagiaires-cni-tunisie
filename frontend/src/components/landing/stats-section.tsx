import { useEffect, useState } from "react"
import { Activity, Building2, GraduationCap, ShieldCheck } from "lucide-react"

interface StatCard {
  label: string
  value: number
  suffix?: string
  hint: string
  icon: React.ReactNode
}

const stats: StatCard[] = [
  {
    label: "Universites partenaires",
    value: 27,
    hint: "Etablissements connectes a la plateforme",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    label: "Demandes traitees / an",
    value: 1800,
    hint: "Flux consolide pour les services administratifs",
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    label: "Respect des delais",
    value: 97,
    suffix: "%",
    hint: "Dossiers instruits selon SLA institutionnel",
    icon: <Activity className="h-5 w-5" />,
  },
  {
    label: "Disponibilite service",
    value: 99.9,
    suffix: "%",
    hint: "Supervision continue et journalisation",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
]

function AnimatedNumber({ value }: { value: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const totalSteps = 36
    const step = value / totalSteps
    let current = 0
    const timer = setInterval(() => {
      current += step
      if (current >= value) {
        setCount(value)
        clearInterval(timer)
        return
      }
      setCount(current)
    }, 24)

    return () => clearInterval(timer)
  }, [value])

  return <>{count % 1 === 0 ? Math.round(count) : count.toFixed(1)}</>
}

export function StatsSection() {
  return (
    <section id="chiffres" className="mx-auto max-w-7xl px-6 pb-20">
      <div className="rounded-3xl border border-indigo-100 bg-white p-8 shadow-sm sm:p-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-700">Indicateurs clefs</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              Une plateforme fiable pour la gestion academique
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Systeme operationnel
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <article
              key={item.label}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-white hover:shadow-md hover:shadow-indigo-100/40"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 transition-transform group-hover:scale-105">
                  {item.icon}
                </span>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-600">{item.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                <AnimatedNumber value={item.value} />
                {item.suffix ?? ""}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.hint}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
