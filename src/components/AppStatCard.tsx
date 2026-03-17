import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type AppStatCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  valueClassName?: string
  iconClassName?: string
}

export function AppStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName = 'text-white',
  iconClassName = 'text-blue-300',
}: AppStatCardProps) {
  return (
    <div className="premium-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-400">{title}</p>
          <h3 className={cn('text-3xl font-bold tracking-tight', valueClassName)}>{value}</h3>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
        </div>

        {Icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60">
            <Icon className={cn('h-5 w-5', iconClassName)} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
