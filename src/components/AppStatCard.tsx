'use client'

type AppStatCardProps = {
  title: string
  value: string | number
  subtitle?: string
  valueClassName?: string
}

export function AppStatCard({
  title,
  value,
  subtitle,
  valueClassName = 'text-white',
}: AppStatCardProps) {
  return (
    <div className="rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
      <p className="text-[#94a3b8] text-sm mb-2">{title}</p>
      <p className={`text-3xl font-bold ${valueClassName}`}>{value}</p>
      {subtitle ? <p className="text-[#64748b] text-sm mt-2">{subtitle}</p> : null}
    </div>
  )
}
