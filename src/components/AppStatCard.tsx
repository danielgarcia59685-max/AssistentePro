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
    <div className="rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#94a3b8] mb-2">{title}</p>
          <h3 className={`text-3xl font-bold ${valueClassName}`}>{value}</h3>
          {subtitle ? <p className="text-sm text-[#64748b] mt-2">{subtitle}</p> : null}
        </div>

        {Icon ? (
          <div className="w-12 h-12 rounded-2xl bg-[#030b1d] border border-[#1f2a44] flex items-center justify-center">
            <Icon className="w-6 h-6 text-[#94a3b8]" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
