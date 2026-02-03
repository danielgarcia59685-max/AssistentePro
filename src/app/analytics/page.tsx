'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  category_id?: string | null
  categories?: { name: string } | null
  description: string
  date: string
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [categoryData, setCategoryData] = useState<Record<string, number>>({})
  const [dateFilter, setDateFilter] = useState('all')
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState('BRL')

  const dateRange = useMemo(() => {
    if (month) {
      const [yearStr, monthStr] = month.split('-')
      const year = Number(yearStr)
      const monthNumber = Number(monthStr)
      if (!year || !monthNumber) return { start: null, end: null }
      const lastDay = new Date(year, monthNumber, 0).getDate()
      const start = `${yearStr}-${monthStr}-01`
      const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`
      return { start, end }
    }

    return {
      start: startDate || null,
      end: endDate || null,
    }
  }, [month, startDate, endDate])

  useEffect(() => {
    if (authLoading || !userId) return
    fetchProfileCurrency()
    fetchData()
  }, [dateFilter, dateRange.start, dateRange.end, search, authLoading, userId])

  const fetchProfileCurrency = async () => {
    if (!supabase || !userId) return
    const { data } = await supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .single()
    if (data?.currency) setCurrency(data.currency)
  }

  const fetchData = async () => {
    if (!supabase || !userId) return

    try {
      let query = supabase
        .from('transactions')
        .select('id, amount, type, description, date, category_id, categories(name)')
        .eq('user_id', userId)
      
      if (dateRange.start || dateRange.end) {
        if (dateRange.start) query = query.gte('date', dateRange.start)
        if (dateRange.end) query = query.lte('date', dateRange.end)
      } else {
        // Apply quick date filter
        const today = new Date()
        if (dateFilter === 'month') {
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
          query = query.gte('date', monthStart)
        } else if (dateFilter === 'quarter') {
          const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1).toISOString().split('T')[0]
          query = query.gte('date', quarterStart)
        } else if (dateFilter === 'year') {
          const yearStart = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0]
          query = query.gte('date', yearStart)
        }
      }

      if (search.trim()) {
        const term = search.trim()
        query = query.or(`categories.name.ilike.%${term}%,description.ilike.%${term}%`)
      }

      const { data, error } = await query.order('date', { ascending: false })

      if (!error && data) {
        setTransactions(data)
        
        const income = data.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
        const expense = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)
        setTotalIncome(income)
        setTotalExpense(expense)

        // Calculate category breakdown
        const categories: Record<string, number> = {}
        data.forEach(t => {
          const name = t.categories?.name || 'Outros'
          categories[name] = (categories[name] || 0) + Number(t.amount)
        })
        setCategoryData(categories)
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    }
  }

  const balance = totalIncome - totalExpense

  const handleCategoryClick = (category: string) => {
    const params = new URLSearchParams()
    params.set('category', category)
    if (month) {
      params.set('month', month)
    } else {
      if (dateRange.start) params.set('start', dateRange.start)
      if (dateRange.end) params.set('end', dateRange.end)
    }
    router.push(`/transactions?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Relatórios</h1>
          <p className="text-gray-400">Análise detalhada de seus gastos e receitas</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Receitas</p>
            <p className="text-3xl font-bold text-green-500">{formatCurrency(totalIncome, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Período selecionado</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Despesas</p>
            <p className="text-3xl font-bold text-red-500">{formatCurrency(totalExpense, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Período selecionado</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-amber-600/30 p-6">
            <p className="text-amber-600 text-sm mb-2 font-medium">Saldo</p>
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(balance, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Receitas - Despesas</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Transações</p>
            <p className="text-3xl font-bold text-blue-500">{transactions.length}</p>
            <p className="text-xs text-gray-500 mt-2">Total registrado</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-3 flex-wrap">
          {['all', 'month', 'quarter', 'year'].map(period => (
            <Button
              key={period}
              onClick={() => setDateFilter(period)}
              className={`rounded-xl transition-all ${
                dateFilter === period
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {period === 'all' ? 'Todos' : period === 'month' ? 'Mês' : period === 'quarter' ? 'Trimestre' : 'Ano'}
            </Button>
          ))}
        </div>

        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Mês</Label>
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
              className="bg-gray-800 border-gray-700 text-white rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Data inicial</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value) setMonth('')
              }}
              className="bg-gray-800 border-gray-700 text-white rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Data final</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                if (e.target.value) setMonth('')
              }}
              className="bg-gray-800 border-gray-700 text-white rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Pesquisa</Label>
            <Input
              type="text"
              placeholder="Categoria ou descrição"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white rounded-xl"
            />
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-600" />
            Análise por Categoria
          </h2>
          
          <div className="space-y-4">
            {Object.entries(categoryData).length === 0 ? (
              <p className="text-gray-400 text-center py-8">Nenhuma transação registrada</p>
            ) : (
              Object.entries(categoryData)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => {
                  const percentage = totalIncome + totalExpense > 0 ? (amount / (totalIncome + totalExpense)) * 100 : 0
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => handleCategoryClick(category)}
                      className="w-full text-left"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-300 capitalize font-medium">{category}</span>
                        <span className="text-amber-600 font-semibold">{formatCurrency(amount, currency)}</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-amber-600 to-amber-500 h-2 rounded-full"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">{percentage.toFixed(1)}%</p>
                    </button>
                  )
                })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL'
  }).format(Number(value) || 0)
}
