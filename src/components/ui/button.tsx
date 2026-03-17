import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_10px_24px_rgba(59,130,246,0.22)] hover:-translate-y-0.5 hover:brightness-105',
        destructive:
          'bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/20',
        outline:
          'border border-white/10 bg-slate-950/70 text-slate-200 hover:bg-slate-800',
        secondary:
          'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
        ghost:
          'text-slate-300 hover:bg-white/5 hover:text-white',
        link:
          'text-blue-400 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2.5',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-12 px-6 text-sm',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
