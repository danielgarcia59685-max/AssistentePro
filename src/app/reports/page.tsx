'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { Navigation } from '@/components/Navigation'

interface MonthlyData {
  month: string
  income: number
  expense: number
}

interface CategoryData {
  name: string
  value: number
}

export default function ReportsPage() {
  const router = useRouter()
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currency, setCurrency] = useState('BRL')
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({})

  const totals = useMemo(() => {
    const income = monthlyData.reduce((sum, row) => sum + Number(row.income || 0), 0)
    const expense = monthlyData.reduce((sum, row) => sum + Number(row.expense || 0), 0)
    return { income, expense, balance: income - expense }
  }, [monthlyData])
  const { userId, loading: authLoading } = useAuth()

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
    fetchCategories()
    fetchMonthlyReport()
    fetchCategoryReport()
  }, [authLoading, userId, dateRange.start, dateRange.end])

  useEffect(() => {
    if (authLoading || !userId) return
    fetchCategoryReport()
  }, [categoriesMap])

  const fetchProfileCurrency = async () => {
    if (!supabase || !userId) return
    const { data } = await supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .single()

    if (data?.currency) setCurrency(data.currency)
  }

  const fetchCategories = async () => {
    if (!supabase || !userId) return
    try {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)

      if (data) {
        const map = data.reduce((acc: Record<string, string>, row) => {
          acc[row.id] = row.name
          return acc
        }, {})
        setCategoriesMap(map)
      }
    } catch (error) {
      console.warn('Categorias não disponíveis:', error)
    }
  }

  const fetchMonthlyReport = async () => {
    if (!supabase || !userId) {
      console.warn('Supabase não está configurado')
      return
    }

    setIsLoading(true)
    
    // Agrupar por mês
    let query = supabase
      .from('transactions')
      .select('amount, type, date')
      .eq('user_id', userId)

    if (dateRange.start) {
      query = query.gte('date', dateRange.start)
    }

    if (dateRange.end) {
      query = query.lte('date', dateRange.end)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
    } else {
      const grouped = data.reduce((acc, transaction) => {
        const month = new Date(transaction.date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        if (!acc[month]) acc[month] = { income: 0, expense: 0 }
        if (transaction.type === 'income') acc[month].income += Number(transaction.amount)
        else acc[month].expense += Number(transaction.amount)
        return acc
      }, {} as Record<string, { income: number; expense: number }>)

      const chartData = Object.entries(grouped).map(([month, values]) => ({
        month,
        income: values.income,
        expense: values.expense
      }))
      setMonthlyData(chartData)
    }
    setIsLoading(false)
  }

  const fetchCategoryReport = async () => {
    if (!supabase || !userId) {
      console.warn('Supabase não está configurado')
      return
    }
    
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('type', 'expense')
      .eq('user_id', userId)

    if (dateRange.start) {
      query = query.gte('date', dateRange.start)
    }

    if (dateRange.end) {
      query = query.lte('date', dateRange.end)
    }

    const { data, error } = await query

    if (error) console.error(error)
    else {
      const grouped = data.reduce((acc, transaction: any) => {
        const category = transaction.category || categoriesMap[transaction.category_id || ''] || 'Outros'
        acc[category] = (acc[category] || 0) + Number(transaction.amount)
        return acc
      }, {} as Record<string, number>)

      const chartData = Object.entries(grouped).map(([name, value]) => ({ name, value }))
      setCategoryData(chartData)
    }
  }

  const COLORS = ['#22c55e', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6']

  const handleCategoryClick = (name: string) => {
    const params = new URLSearchParams()
    params.set('category', name)
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Relatórios</h1>
          <p className="text-gray-400">Análise detalhada de seus gastos e receitas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Receitas</p>
            <p className="text-3xl font-bold text-green-500">{formatCurrency(totals.income, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Período selecionado</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Despesas</p>
            <p className="text-3xl font-bold text-red-500">{formatCurrency(totals.expense, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Período selecionado</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-amber-600/30 p-6">
            <p className="text-amber-600 text-sm mb-2 font-medium">Saldo</p>
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(totals.balance, currency)}</p>
            <p className="text-xs text-gray-500 mt-2">Receitas - Despesas</p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white"
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
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white"
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
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMonth('')
                setStartDate('')
                setEndDate('')
              }}
            >
              Limpar filtros
            </Button>
            {isLoading && <span className="text-sm text-gray-500">Atualizando relatórios...</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Receitas vs Despesas</h2>
                <p className="text-sm text-gray-400">Comparativo mensal</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-600" /> Receitas
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> Despesas
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData} barCategoryGap={16} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={{ stroke: '#1f2937' }} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={{ stroke: '#1f2937' }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, currency)}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1f2937', borderRadius: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  itemStyle={{ color: '#cbd5f5' }}
                />
                <Bar dataKey="income" fill="#16a34a" name="Receitas" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" name="Despesas" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Despesas por Categoria</h2>
                <p className="text-sm text-gray-400">Distribuição do período</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, currency)}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1f2937', borderRadius: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  itemStyle={{ color: '#cbd5f5' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {categoryData.length > 0 && (
              <div className="mt-6 space-y-3">
                {categoryData.map((item, index) => (
                  <button
                    key={item.name}
                    onClick={() => handleCategoryClick(item.name)}
                    className="w-full flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 text-left text-sm text-gray-300 hover:border-amber-600/40 hover:text-amber-400 transition"
                  >
                    <span className="flex items-center gap-3 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      {item.name}
                    </span>
                    <span>{formatCurrency(item.value, currency)}</span>
                  </button>
                ))}
              </div>
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