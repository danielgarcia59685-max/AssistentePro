'use client'

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, SlidersHorizontal, X } from 'lucide-react'

type CompactFilterBarProps = {
  search: string
  onSearchChange: (value: string) => void
  onToggleFilters: () => void
  onClear: () => void
  showFilters: boolean
  placeholder?: string
  children?: ReactNode
  hideSearch?: boolean
  searchClassName?: string
}

export function CompactFilterBar({
  search,
  onSearchChange,
  onToggleFilters,
  onClear,
  showFilters,
  placeholder = 'Pesquisar...',
  children,
  hideSearch = false,
  searchClassName = 'lg:max-w-sm',
}: CompactFilterBarProps) {
  return (
    <div className="bg-[#08152d] rounded-2xl border border-[#1f2a44] p-4 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {!hideSearch && (
          <div className={`relative w-full ${searchClassName}`}>
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              placeholder={placeholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-11 pl-10 bg-[#1a263d] border-[#2a3650] rounded-xl text-white placeholder:text-[#64748b]"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onToggleFilters}
            className="h-11 border-[#2a3650] bg-black text-white hover:bg-[#111827] rounded-xl"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filtros
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            className="h-11 border-[#2a3650] bg-black text-white hover:bg-[#111827] rounded-xl"
          >
            <X className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

      {showFilters && children ? (
        <div className="mt-4 pt-4 border-t border-[#1f2a44]">{children}</div>
      ) : null}
    </div>
  )
}
