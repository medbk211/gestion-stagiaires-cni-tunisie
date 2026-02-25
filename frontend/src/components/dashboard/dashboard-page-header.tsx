import { cn } from "@/lib/utils"

interface DashboardPageHeaderProps {
  title: string
  subtitle?: string
  kicker?: string
  actions?: React.ReactNode
  className?: string
}

export function DashboardPageHeader({
  title,
  subtitle,
  kicker,
  actions,
  className,
}: DashboardPageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        {kicker ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{kicker}</p>
        ) : null}
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
