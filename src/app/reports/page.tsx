'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TxType, MonthlyData, CategoryData, DateRange } from '@/types/finance'
import { formatCurrencyBRL } from '@/lib/format'
import { toast } from '@/hooks/useToast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  PieChartIcon,
  BarChart3,
  Download,
  Filter,
  RotateCcw,
} from 'lucide-react'

type TransactionRowEN = {
  id: string
  amount: number | string | null
  type: TxType
  date: string
  category: string | null
  description: string | null
}

function clamp2(n: number) {
  return Math.round(n * 100) / 100
}

function addOneYearBack(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y - 1, (m || 1) - 1, d || 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function monthKeyFromISO(iso: string) {
  return iso.slice(0, 7)
}

function monthLabelPT(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, 1)
  return dt.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function formatCompactBRL(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${Math.round(n)}`
}

function isValidISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export default function ReportsPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()

  const [draftMonth, setDraftMonth] = useState('')
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')

  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [kpis, setKpis] = useState({ income: 0, expense: 0, balance: 0 })
  const [yoy, setYoy] = useState({
    incomePct: null as number | null,
    expensePct: null as number | null,
    balancePct: null as number | null,
  })

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryTx, setCategoryTx] = useState<TransactionRowEN[]>([])
  const [categoryTxLoading, setCategoryTxLoading] = useState(false)

  const reportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
    }
  }, [authLoading, userId, router])

  const dateRange: DateRange = useMemo(() => {
    if (month) {
      const [yearStr, monthStr] = month.split('-')
      const year = Number(yearStr)
      const monthNumber = Number(monthStr)

      if (!year || !monthNumber) return { start: null, end: null }

      const lastDay = new Date(year, monthNumber, 0).getDate()

      return {
        start: `${yearStr}-${monthStr}-01`,
        end: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
      }
    }

    return { start: startDate || null, end: endDate || null }
  }, [month, startDate, endDate])

  const yoyRange: DateRange = useMemo(() => {
    if (!dateRange.start && !dateRange.end) return { start: null, end: null }

    return {
      start: dateRange.start ? addOneYearBack(dateRange.start) : null,
      end: dateRange.end ? addOneYearBack(dateRange.end) : null,
    }
  }, [dateRange.start, dateRange.end])

  const dateError = useMemo(() => {
    if (draftMonth) return null
    if (draftStartDate && !isValidISODate(draftStartDate)) return 'Data inicial inválida'
    if (draftEndDate && !isValidISODate(draftEndDate)) return 'Data final inválida'
    if (draftStartDate && draftEndDate && draftStartDate > draftEndDate) {
      return 'Data inicial não pode ser maior que a data final'
    }
    return null
  }, [draftMonth, draftStartDate, draftEndDate])

  const buildTxQuery = useCallback(
    (select: string) => {
      if (!supabase || !userId) return null

      let query = supabase.from('transactions').select(select).eq('user_id', userId)

      if (dateRange.start) query = query.gte('date', dateRange.start)
      if (dateRange.end) query = query.lte('date', dateRange.end)

      return query
    },
    [userId, dateRange.start, dateRange.end],
  )

  const buildTxQueryForRange = useCallback(
    (range: DateRange, select: string) => {
      if (!supabase || !userId) return null

      let query = supabase.from('transactions').select(select).eq('user_id', userId)

      if (range.start) query = query.gte('date', range.start)
      if (range.end) query = query.lte('date', range.end)

      return query
    },
    [userId],
  )

  const fetchMonthlyReport = useCallback(async () => {
    const query = buildTxQuery('amount, type, date')
    if (!query) return

    const { data, error } = await query.returns<
      { amount: number | string | null; type: TxType; date: string }[]
    >()

    if (error) throw error

    const grouped: Record<string, { income: number; expense: number }> = {}

    for (const t of data ?? []) {
      const key = monthKeyFromISO(t.date)
      if (!grouped[key]) grouped[key] = { income: 0, expense: 0 }

      const amt = Number(t.amount) || 0
      if (t.type === 'income') grouped[key].income += amt
      else grouped[key].expense += amt
    }

    const chartData: MonthlyData[] = Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => {
        const income = grouped[key].income
        const expense = grouped[key].expense
        return {
          key,
          label: monthLabelPT(key),
          income,
          expense,
          balance: income - expense,
        }
      })

    setMonthlyData(chartData)
  }, [buildTxQuery])

  const fetchCategoryReport = useCallback(async () => {
    if (!supabase || !userId) return

    let query = supabase
      .from('transactions')
      .select('amount, category, type, date')
      .eq('user_id', userId)
      .eq('type', 'expense')

    if (dateRange.start) query = query.gte('date', dateRange.start)
    if (dateRange.end) query = query.lte('date', dateRange.end)

    const { data, error } = await query
    if (error) throw error

    const grouped: Record<string, number> = {}
    let total = 0

    for (const t of (data ?? []) as Array<{ amount: number | string | null; category: string | null }>) {
      const name = t.category?.trim() || 'Outros'
      const amt = Number(t.amount) || 0
      grouped[name] = (grouped[name] || 0) + amt
      total += amt
    }

    const chartData: CategoryData[] = Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value,
        percent: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)

    setCategoryData(chartData)
  }, [dateRange.end, dateRange.start, userId])

  const fetchKpisAndYoy = useCallback(async () => {
    const currentQuery = buildTxQueryForRange(dateRange, 'amount, type')
    const previousQuery = buildTxQueryForRange(yoyRange, 'amount, type')

    if (!currentQuery || !previousQuery) return

    const [curRes, prevRes] = await Promise.all([
      currentQuery.returns<{ amount: number | string | null; type: TxType }[]>(),
      previousQuery.returns<{ amount: number | string | null; type: TxType }[]>(),
    ])

    if (curRes.error) throw curRes.error
    if (prevRes.error) throw prevRes.error

    const sum = (arr: Array<{ amount: number | string | null; type: TxType }>) => {
      let income = 0
      let expense = 0

      for (const t of arr) {
        const amt = Number(t.amount) || 0
        if (t.type === 'income') income += amt
        else expense += amt
      }

      return { income, expense, balance: income - expense }
    }

    const curSum = sum(curRes.data ?? [])
    const prevSum = sum(prevRes.data ?? [])

    setKpis(curSum)

    const pct = (current: number, previous: number) => {
      if (!dateRange.start && !dateRange.end) return null
      if (previous === 0) return null
      return clamp2(((current - previous) / previous) * 100)
    }

    setYoy({
      incomePct: pct(curSum.income, prevSum.income),
      expensePct: pct(curSum.expense, prevSum.expense),
      balancePct: pct(curSum.balance, prevSum.balance),
    })
  }, [buildTxQueryForRange, dateRange, yoyRange])

  const refreshAll = useCallback(async () => {
    if (!supabase || !userId) return

    setIsLoading(true)

    try {
      await Promise.all([fetchMonthlyReport(), fetchCategoryReport(), fetchKpisAndYoy()])
    } catch (e: any) {
      console.error('Erro ao atualizar relatórios:', e)
      toast({
        title: 'Erro',
        description: e?.message || 'Não foi possível carregar os relatórios',
        variant: 'destructive',
      })
      setMonthlyData([])
      setCategoryData([])
      setKpis({ income: 0, expense: 0, balance: 0 })
      setYoy({ incomePct: null, expensePct: null, balancePct: null })
    } finally {
      setIsLoading(false)
    }
  }, [fetchMonthlyReport, fetchCategoryReport, fetchKpisAndYoy, userId])

  useEffect(() => {
    if (authLoading || !userId || !supabase) return
    void refreshAll()
  }, [authLoading, userId, refreshAll])

  const bestAndWorst = useMemo(() => {
    if (!monthlyData.length) return { best: null as MonthlyData | null, worst: null as MonthlyData | null }
    const sorted = [...monthlyData].sort((a, b) => b.balance - a.balance)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [monthlyData])

  const COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#a78bfa', '#fb7185', '#f97316', '#34d399', '#fbbf24']

  const openCategory = async (name: string) => {
    if (!supabase || !userId) return

    setSelectedCategory(name)
    setCategoryTx([])
    setCategoryTxLoading(true)

    try {
      let query = supabase
        .from('transactions')
        .select('id, amount, type, category, description, date')
        .eq('user_id', userId)
        .eq('type', 'expense')

      if (name === 'Outros') {
        query = query.or('category.is.null,category.eq.')
      } else {
        query = query.eq('category', name)
      }

      if (dateRange.start) query = query.gte('date', dateRange.start)
      if (dateRange.end) query = query.lte('date', dateRange.end)

      const { data, error } = await query.order('date', { ascending: false }).limit(200)

      if (error) throw error

      setCategoryTx((data || []) as TransactionRowEN[])
    } catch (e) {
      console.error('Erro ao buscar transações da categoria:', e)
      setCategoryTx([])
    } finally {
      setCategoryTxLoading(false)
    }
  }

  const closeCategory = () => {
    setSelectedCategory(null)
    setCategoryTx([])
  }

  const filterLabel = useMemo(() => {
    if (month) return `Mês: ${month}`
    if (dateRange.start || dateRange.end) {
      return `Período: ${dateRange.start ?? '...'} até ${dateRange.end ?? '...'}`
    }
    return 'Período: todos os registros'
  }, [month, dateRange.start, dateRange.end])

  const applyFilters = () => {
    if (dateError) return
    setMonth(draftMonth)
    setStartDate(draftStartDate)
    setEndDate(draftEndDate)
  }

  const clearFilters = () => {
    setDraftMonth('')
    setDraftStartDate('')
    setDraftEndDate('')
    setMonth('')
    setStartDate('')
    setEndDate('')
  }

  const exportPDF = async () => {
    if (!reportRef.current) return

    setExportingPdf(true)

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#000000',
        scale: 2,
        useCORS: true,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
        heightLeft -= pageHeight
      }

      const nameSafe = `relatorio-${(month || 'periodo').replace(/[^\w-]/g, '_')}.pdf`
      pdf.save(nameSafe)
    } catch (e) {
      console.error('Erro ao exportar PDF:', e)
      toast({
        title: 'Erro',
        description: 'Não foi possível exportar o PDF. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setExportingPdf(false)
    }
  }

  const YoYBadge = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-xs text-gray-500">YoY: —</span>

    const positive = value >= 0

    return (
      <span
        className={`text-xs font-medium flex items-center gap-1 ${
          positive ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {positive ? '+' : ''}
        {value}% vs ano anterior
      </span>
    )
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-black p-6">
        <Navigation />
        <div className="max-w-3xl mx-auto mt-10 text-gray-300">Supabase não configurado.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div ref={reportRef}>
          <div className="flex flex-col gap-3 mb-8">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-600/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Relatórios Financeiros</h1>
                  <p className="text-gray-400">{filterLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={exportPDF}
                  disabled={exportingPdf}
                  className="bg-gray-800 text-white hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
                </Button>
              </div>
            </div>
          </div>

          <Card className="mb-8 bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                Filtros de Período
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300 font-medium">Mês específico</Label>
                  <Input
                    type="month"
                    value={draftMonth}
                    onChange={(e) => {
                      const v = e.target.value
                      setDraftMonth(v)
                      if (v) {
                        setDraftStartDate('')
                        setDraftEndDate('')
                      }
                    }}
                    className="bg-gray-800 border-gray-700 text-white rounded-lg"
                  />
                  <p className="text-xs text-gray-500">Se escolher mês, as datas são ignoradas.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 font-medium">Data inicial</Label>
                  <Input
                    type="date"
                    value={draftStartDate}
                    onChange={(e) => {
                      const v = e.target.value
                      setDraftStartDate(v)
                      if (v) setDraftMonth('')
                    }}
                    className="bg-gray-800 border-gray-700 text-white rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 font-medium">Data final</Label>
                  <Input
                    type="date"
                    value={draftEndDate}
                    onChange={(e) => {
                      const v = e.target.value
                      setDraftEndDate(v)
                      if (v) setDraftMonth('')
                    }}
                    className="bg-gray-800 border-gray-700 text-white rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={applyFilters}
                    disabled={Boolean(dateError)}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Aplicar
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-amber-600"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Limpar
                  </Button>

                  {dateError ? <div className="text-sm text-red-400">{dateError}</div> : null}
                </div>

                {isLoading && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Atualizando relatórios...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-green-400 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Receitas do Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-2">
                  {formatCurrencyBRL(kpis.income)}
                </div>
                <YoYBadge value={yoy.incomePct} />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-red-400 text-sm flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Despesas do Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-2">
                  {formatCurrencyBRL(kpis.expense)}
                </div>
                <YoYBadge value={yoy.expensePct} />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Saldo Líquido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white mb-2">
                  {formatCurrencyBRL(kpis.balance)}
                </div>
                <YoYBadge value={yoy.balancePct} />
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}
