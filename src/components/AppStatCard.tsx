import { LucideIcon } from 'lucide-react'

type AppStatCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  valueClassName?: string
}

export function AppStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName = 'text-white',
}: AppStatCardProps) {
  return (
    <div className="premium-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-sm text-slate-400">{title}</p>
          <h3 className={`text-3xl font-bold tracking-tight ${valueClassName}`}>{value}</h3>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
        </div>

        {Icon ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/15 to-purple-500/15 text-blue-300">
            <Icon className="h-6 w-6" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
