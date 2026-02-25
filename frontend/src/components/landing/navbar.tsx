import { useState } from "react"
import { Link } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { CniBrand } from "@/components/brand/cni-brand"

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navItems = [
    { label: "Plateforme", href: "#plateforme" },
    { label: "Chiffres", href: "#chiffres" },
    { label: "Processus", href: "#workflow" },
    { label: "Espaces", href: "#espaces" },
  ]

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-indigo-100/70 bg-background/90 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="group flex items-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <CniBrand logoClassName="h-10 w-10 transition-transform group-hover:scale-[1.03]" />
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/connexion"
            className="rounded-lg border border-indigo-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-indigo-200 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Connexion
          </Link>
          <Link
            to="/candidature"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Deposer une demande
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-100 text-slate-700 transition-colors hover:bg-indigo-50 md:hidden"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="animate-in slide-in-from-top-2 border-t border-indigo-100 bg-background px-6 pb-6 pt-4 duration-300 md:hidden">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-indigo-100 pt-4">
              <Link
                to="/connexion"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-indigo-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50"
              >
                Connexion
              </Link>
              <Link
                to="/candidature"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-all hover:bg-indigo-700"
              >
                Deposer une demande
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
