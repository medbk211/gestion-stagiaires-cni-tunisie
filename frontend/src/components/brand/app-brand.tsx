import { cn } from "@/lib/utils"

interface AppBrandProps {
  className?: string
  logoClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  subtitle?: string
}

export function AppBrand({
  className,
  logoClassName,
  titleClassName,
  subtitleClassName,
  subtitle = "Gestion des Stagiaires",
}: AppBrandProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src="/stage-logo.svg"
        alt="Plateforme de gestion des stages"
        className={cn("h-11 w-11 rounded-md object-contain", logoClassName)}
      />
      <div className="leading-tight">
        <p className={cn("text-xs text-muted-foreground", subtitleClassName)}>{subtitle}</p>
      </div>
    </div>
  )
}
