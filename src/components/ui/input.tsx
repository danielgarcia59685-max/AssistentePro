import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-sm text-white shadow-none outline-none transition placeholder:text-slate-500',
        'focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/10',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
