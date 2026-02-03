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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

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
            <h2 className="text-xl font-semibold text-white mb-4">Receitas vs Despesas por Mês</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                <Bar dataKey="income" fill="#10B981" name="Receitas" />
                <Bar dataKey="expense" fill="#F97316" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Gastos por Categoria</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
              </PieChart>
            </ResponsiveContainer>
            {categoryData.length > 0 && (
              <div className="mt-6 space-y-3">
                {categoryData.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => handleCategoryClick(item.name)}
                    className="w-full flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 text-left text-sm text-gray-300 hover:border-amber-600/40 hover:text-amber-400 transition"
                  >
                    <span className="font-medium">{item.name}</span>
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