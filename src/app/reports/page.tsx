'use client'

import { useEffect, useMemo, useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CompactFilterBar } from '@/components/CompactFilterBar'
import { AppStatCard } from '@/components/AppStatCard'

type Transaction = {
  id: string
  user_id: string
  amount: number
  type: 'income' | 'expense'
  category?: string | null
  category_id?: string | null
  description?: string | null
  date: string
}

type CategoryRow = {
  id: string
  name: string
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number(value) || 0)
}

function getMonthRange(month: string) {
  if (!month) return { start: '', end: '' }

  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthNumber = Number(monthStr)

  if (!year || !monthNumber) return { start: '', end: '' }

  const lastDay = new Date(year, monthNumber, 0).getDate()

  return {
    start: `${yearStr}-${monthStr}-01`,
    end: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
  }
}

export default function ReportsPage() {
  const { userId, loading: authLoading } = useAuth()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [currency, setCurrency] = useState('BRL')
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)

  const currentMonth = new Date()
  const defaultMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`

  const [month, setMonth] = useState(defaultMonth)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const activeRange = useMemo(() => {
    if (month) {
      return getMonthRange(month)
    }

    return {
      start: startDate,
      end: endDate,
    }
  }, [month, startDate, endDate])

  useEffect(() => {
    if (authLoading || !userId || !supabase) return
    fetchCurrency()
    fetchCategories()
  }, [authLoading, userId])

  useEffect(() => {
    if (authLoading || !userId || !supabase) return
    fetchTransactions()
  }, [authLoading, userId, activeRange.start, activeRange.end])

  const fetchCurrency = async () => {
    const { data } = await supabase.from('users').select('currency').eq('id', userId).single()
    if (data?.currency) setCurrency(data.currency)
  }

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').eq('user_id', userId)

    if (data) {
      const map = (data as CategoryRow[]).reduce((acc: Record<string, string>, row) => {
        acc[row.id] = row.name
        return acc
      }, {})
      setCategoriesMap(map)
    }
  }

  const fetchTransactions = async () => {
    let query = supabase.from('transactions').select('*').eq('user_id', userId)

    if (activeRange.start) {
      query = query.gte('date', activeRange.start)
    }

    if (activeRange.end) {
      query = query.lte('date', activeRange.end)
    }

    const { data, error } = await query.order('date', { ascending: false })

    if (error) {
      console.error('Erro ao buscar transações:', error)
      return
    }

    setTransactions((data || []) as Transaction[])
  }

  const summary = useMemo(() => {
    let income = 0
    let expense = 0

    for (const transaction of transactions) {
      const amount = Number(transaction.amount) || 0
      if (transaction.type === 'income') income += amount
      if (transaction.type === 'expense') expense += amount
    }

    return {
      income,
      expense,
      balance: income - expense,
    }
  }, [transactions])

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {}

    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue

      const categoryName =
        transaction.category ||
        categoriesMap[transaction.category_id || ''] ||
        'Sem categoria'

      map[categoryName] = (map[categoryName] || 0) + (Number(transaction.amount) || 0)
    }

    const total = Object.values(map).reduce((sum, value) => sum + value, 0)

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        percent: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, categoriesMap])

  const incomesByCategory = useMemo(() => {
    const map: Record<string, number> = {}

    for (const transaction of transactions) {
      if (transaction.type !== 'income') continue

      const categoryName =
        transaction.category ||
        categoriesMap[transaction.category_id || ''] ||
        'Sem categoria'

      map[categoryName] = (map[categoryName] || 0) + (Number(transaction.amount) || 0)
    }

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, categoriesMap])

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Relatórios</h1>
          <p className="text-[#94a3b8]">Resumo financeiro por período</p>
        </div>

        <CompactFilterBar
          search=""
          onSearchChange={() => {}}
          onToggleFilters={() => setShowFilters((prev) => !prev)}
          onClear={() => {
            setMonth(defaultMonth)
            setStartDate('')
            setEndDate('')
          }}
          showFilters={showFilters}
          hideSearch
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Mês</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value)
                  if (e.target.value) {
                    setStartDate('')
                    setEndDate('')
                  }
                }}
                className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Data inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
                className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
                className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
              />
            </div>
          </div>
        </CompactFilterBar>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <AppStatCard
            title="Receitas"
            value={formatCurrency(summary.income, currency)}
            subtitle="Total no período"
            valueClassName="text-green-500"
          />
          <AppStatCard
            title="Despesas"
            value={formatCurrency(summary.expense, currency)}
            subtitle="Total no período"
            valueClassName="text-red-500"
          />
          <AppStatCard
            title="Saldo"
            value={formatCurrency(summary.balance, currency)}
            subtitle="Receitas - Despesas"
            valueClassName="text-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
            <h2 className="text-white text-2xl font-semibold mb-4">Despesas por categoria</h2>

            {expensesByCategory.length === 0 ? (
              <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
                Nenhuma despesa no período selecionado.
              </div>
            ) : (
              <div className="space-y-4">
                {expensesByCategory.map((item) => (
                  <div key={item.name} className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] p-4">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div>
                        <p className="text-white font-semibold">{item.name}</p>
                        <p className="text-sm text-[#94a3b8]">{item.percent.toFixed(1)}% do total</p>
                      </div>
                      <p className="text-red-400 font-bold">{formatCurrency(item.value, currency)}</p>
                    </div>

                    <div className="w-full h-3 bg-[#111827] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
            <h2 className="text-white text-2xl font-semibold mb-4">Receitas por categoria</h2>

            {incomesByCategory.length === 0 ? (
              <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
                Nenhuma receita no período selecionado.
              </div>
            ) : (
              <div className="space-y-3">
                {incomesByCategory.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-4 flex items-center justify-between gap-4"
                  >
                    <p className="text-white font-semibold">{item.name}</p>
                    <p className="text-green-400 font-bold">{formatCurrency(item.value, currency)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6 mt-6">
          <h2 className="text-white text-2xl font-semibold mb-4">Transações do período</h2>

          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
              Nenhuma transação encontrada.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const categoryName =
                  transaction.category ||
                  categoriesMap[transaction.category_id || ''] ||
                  'Sem categoria'

                return (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">
                        {transaction.description || 'Sem descrição'}
                      </p>
                      <p className="text-sm text-[#94a3b8]">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')} • {categoryName}
                      </p>
                    </div>

                    <p
                      className={`font-bold ${
                        transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}{' '}
                      {formatCurrency(Math.abs(Number(transaction.amount) || 0), currency)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
