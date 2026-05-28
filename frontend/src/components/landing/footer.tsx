import { Link } from "react-router-dom"
import { Mail, MapPin, Phone } from "lucide-react"
import { AppBrand } from "@/components/brand/app-brand"

const navigation = [
  { label: "Plateforme", href: "#plateforme" },
  { label: "Chiffres", href: "#chiffres" },
  { label: "Processus", href: "#workflow" },
  { label: "Espaces", href: "#espaces" },
]

export function Footer() {
  return (
    <footer className="border-t border-indigo-100 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_1fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <AppBrand />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
              Portail institutionnel de gestion des stages pour la coordination entre etablissements, encadreurs et
              etudiants.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Navigation</p>
            <ul className="mt-4 space-y-2">
              {navigation.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Contact institutionnel</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                Organisation cliente
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                contact@entreprise.com
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                +216 71 000 000
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-indigo-100 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>(c) 2026 Plateforme de Gestion des Stages. Tous droits reserves.</p>
          <div className="flex gap-5">
            <a href="#" className="transition-colors hover:text-slate-700">
              Mentions legales
            </a>
            <a href="#" className="transition-colors hover:text-slate-700">
              Politique de confidentialite
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
