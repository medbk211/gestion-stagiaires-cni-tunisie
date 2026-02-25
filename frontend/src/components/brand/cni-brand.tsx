import { cn } from "@/lib/utils"

interface CniBrandProps {
  className?: string
  logoClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  subtitle?: string
}

export function CniBrand({
  className,
  logoClassName,
  titleClassName,
  subtitleClassName,
  subtitle = "Gestion des Stagiaires",
}: CniBrandProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src="/cni-logo.svg"
        alt="Logo CNI"
        className={cn("h-11 w-11 rounded-md object-contain", logoClassName)}
      />
      <div className="leading-tight">
        <p className={cn("text-sm font-semibold tracking-wide text-indigo-700", titleClassName)}>CNI Tunisia</p>
        <p className={cn("text-xs text-muted-foreground", subtitleClassName)}>{subtitle}</p>
      </div>
    </div>
  )
}
