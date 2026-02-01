'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Menu, X, BarChart3, FileText, DollarSign, Calendar, Target, LogOut } from 'lucide-react'

export function Navigation() {
  const { logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const links = [
    { href: '/dashboard', label: 'Página inicial', icon: DollarSign },
    { href: '/transactions', label: 'Transações', icon: DollarSign },
    { href: '/analytics', label: 'Relatórios', icon: BarChart3 },
    { href: '/bills', label: 'Contas', icon: FileText },
    { href: '/reminders', label: 'Compromissos', icon: Calendar },
    { href: '/goals', label: 'Metas', icon: Target },
  ]

  return (
    <nav className="bg-gray-900 text-gray-200 shadow-lg border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-amber-600/50 group-hover:shadow-2xl transition-all">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-lg text-white">Assistente<span className="text-amber-600">Pro</span></p>
              <p className="text-xs text-gray-500">Financial Manager</p>
            </div>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-amber-600 hover:bg-gray-800/50 rounded-lg transition-all duration-200"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop Logout */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              onClick={logout}
              variant="outline"
              className="border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-amber-600 hover:border-amber-600/50 transition-all"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-400 hover:text-amber-600 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Links */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2 border-t border-gray-800 pt-4">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:text-amber-600 hover:bg-gray-800/50 rounded transition-all"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-amber-600 hover:bg-gray-800/50 rounded transition-all flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
