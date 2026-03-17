'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import useAuth from '@/hooks/useAuth'
import { Menu, X, BarChart3, FileText, DollarSign, Calendar, Target, LogOut, Settings, Home, ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navigation() {
  const { logout } = useAuth()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const links = useMemo(
    () => [
      { href: '/dashboard', label: 'Página inicial', icon: Home },
      { href: '/transactions', label: 'Transações', icon: DollarSign },
      { href: '/reports', label: 'Relatórios', icon: BarChart3 },
      { href: '/bills', label: 'Contas', icon: ReceiptText },
      { href: '/reminders', label: 'Compromissos', icon: Calendar },
      { href: '/goals', label: 'Metas', icon: Target },
      { href: '/onboarding', label: 'Perfil', icon: Settings },
    ],
    [],
  )

  const isActive = (href: string) => pathname === href

  return (
    <header className="glass-topbar sticky top-0 z-50">
      <div className="mx-auto flex h-22 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/10">
            <Image
              src="/logo.png"
              alt="AssistentePro"
              width={34}
              height={34}
              className="h-8 w-8 object-contain"
              priority
            />
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-2xl font-bold text-white">
              Assistente<span className="text-amber-400">Pro</span>
            </p>
            <p className="truncate text-sm text-slate-500">assistente financeiro pessoal</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn('nav-link', isActive(href) && 'nav-link-active')}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            onClick={logout}
            className="premium-button-secondary px-4 py-2.5"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 lg:hidden"
          onClick={() => setIsOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isOpen ? (
        <div className="border-t border-white/10 px-4 pb-4 pt-4 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'nav-link w-full justify-start',
                  isActive(href) && 'nav-link-active',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}

            <button
              onClick={logout}
              className="premium-button-secondary mt-2 justify-center"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      ) : null}
    </header>
  )
}
