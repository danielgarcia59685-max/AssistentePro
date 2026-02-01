'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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
    fetchMonthlyReport()
    fetchCategoryReport()
  }, [authLoading, userId, dateRange.start, dateRange.end])

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
        if (transaction.type === 'income') acc[month].income += transaction.amount
        else acc[month].expense += transaction.amount
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
      .select('amount, category')
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
      const grouped = data.reduce((acc, transaction) => {
        const category = transaction.category || 'Outros'
        acc[category] = (acc[category] || 0) + transaction.amount
        return acc
      }, {} as Record<string, number>)

      const chartData = Object.entries(grouped).map(([name, value]) => ({ name, value }))
      setCategoryData(chartData)
    }
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-6 text-white">Relatórios</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
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
              />
            </div>
            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receitas vs Despesas por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="income" fill="#00C49F" name="Receitas" />
                <Bar dataKey="expense" fill="#FF8042" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      </main>
    </div>
  )
}