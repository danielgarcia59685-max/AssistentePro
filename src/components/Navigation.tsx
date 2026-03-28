'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import useAuth from '@/hooks/useAuth'
import {
  BarChart3,
  Calendar,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Target,
  Wallet,
  X,
} from 'lucide-react'

export function Navigation() {
  const pathname = usePathname()
  const { logout, userEmail } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const links = useMemo(
    () => [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/transactions', label: 'Transações', icon: Wallet },
      { href: '/bills', label: 'Contas', icon: CreditCard },
      { href: '/reminders', label: 'Compromissos', icon: Calendar },
      { href: '/goals', label: 'Metas', icon: Target },
      { href: '/reports', label: 'Relatórios', icon: BarChart3 },
      { href: '/onboarding', label: 'Perfil', icon: Settings },
    ],
    [],
  )

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050816]/80 text-slate-100 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex min-h-20 items-center justify-between gap-4 py-4">
          <Link href="/dashboard" className="group flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 shadow-lg shadow-purple-500/10">
              <Image
                src="/logo.png"
                alt="AssistentePro"
                width={34}
                height={34}
                className="h-8 w-8 object-contain"
                priority
              />
            </div>

            <div className="hidden sm:block">
              <p className="text-lg font-bold text-white">
                Assistente<span className="text-gradient-premium">Pro</span>
              </p>
              <p className="text-xs text-slate-400">premium fintech dark</p>
            </div>
          </Link>

          <div className="hidden xl:flex items-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-1.5">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href

              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                    active
                      ? 'border border-blue-400/20 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.08)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="hidden 2xl:block text-right">
              <p className="text-sm font-medium text-white">Conta conectada</p>
              <p className="max-w-[220px] truncate text-xs text-slate-400">
                {userEmail || 'Usuário autenticado'}
              </p>
            </div>

            <button
              onClick={logout}
              className="premium-button-secondary px-4 py-2.5 text-sm"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </button>
          </div>

          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 text-slate-300 transition hover:bg-slate-800/80 hover:text-white md:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Abrir menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden pb-4">
            <div className="premium-panel-soft space-y-2 p-3">
              {links.map(({ href, label, icon: Icon }) => {
                const active = pathname === href

                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                      active
                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white',
                    ].join(' ')}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                )
              })}

              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-400 transition-all hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
