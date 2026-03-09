'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TxType, MonthlyData, CategoryData, DateRange } from '@/types/finance'
import { formatCurrencyBRL } from '@/lib/format'
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
  // espera YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export default function ReportsPage() {
  const { userId, loading: authLoading } = useAuth()

  // Draft (inputs)
  const [draftMonth, setDraftMonth] = useState('')
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')

  // Applied (used for queries)
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [isLoading, setIsLoading] = useState(false)

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

  const [exportingPdf, setExportingPdf] = useState(false)

  const reportRef = useRef<HTMLDivElement | null>(null)

  const dateRange: DateRange = useMemo(() => {
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
    if (draftStartDate && draftEndDate && draftStartDate > draftEndDate) return 'Data inicial não pode ser maior que a data final'
    return null
  }, [draftMonth, draftStartDate, draftEndDate])

  useEffect(() => {
    if (authLoading || !userId) return
    if (!supabase) return
    void refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId, dateRange.start, dateRange.end])

  const refreshAll = async () => {
    await Promise.all([fetchMonthlyReport(), fetchCategoryReport(), fetchKpisAndYoy()])
  }

  const buildTxQuery = (select: string) => {
    let query = supabase!.from('transactions').select(select).eq('user_id', userId as string)
    if (dateRange.start) query = query.gte('date', dateRange.start)
    if (dateRange.end) query = query.lte('date', dateRange.end)
    return query
  }

  const buildTxQueryForRange = (range: DateRange, select: string) => {
    let query = supabase!.from('transactions').select(select).eq('user_id', userId as string)
    if (range.start) query = query.gte('date', range.start)
    if (range.end) query = query.lte('date', range.end)
    return query
  }

  const fetchMonthlyReport = async () => {
    if (!supabase || !userId) return
    setIsLoading(true)

    try {
      const { data, error } = await buildTxQuery('amount, type, date').returns<
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
    } catch (e) {
      console.error('Erro monthly report:', e)
      setMonthlyData([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategoryReport = async () => {
    if (!supabase || !userId) return
    try {
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
        const name = (t.category?.trim() || 'Outros') as string
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
    } catch (e) {
      console.error('Erro category report:', e)
      setCategoryData([])
    }
  }

  const fetchKpisAndYoy = async () => {
    if (!supabase || !userId) return

    try {
      const [curRes, prevRes] = await Promise.all([
        buildTxQueryForRange(dateRange, 'amount, type').returns<{ amount: number | string | null; type: TxType }[]>(),
        buildTxQueryForRange(yoyRange, 'amount, type').returns<{ amount: number | string | null; type: TxType }[]>(),
      ])

      if (curRes.error) throw curRes.error
      if (prevRes.error) throw prevRes.error

      const cur = curRes.data ?? []
      const prev = prevRes.data ?? []

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

      const curSum = sum(cur)
      const prevSum = sum(prev)

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
    } catch (e) {
      console.error('Erro KPIs/YoY:', e)
      setKpis({ income: 0, expense: 0, balance: 0 })
      setYoy({ incomePct: null, expensePct: null, balancePct: null })
    }
  }

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

      if (name === 'Outros') query = query.is('category', null)
      else query = query.eq('category', name)

      if (dateRange.start) query = query.gte('date', dateRange.start)
      if (dateRange.end) query = query.lte('date', dateRange.end)

      const { data, error } = await query.order('date', { ascending: false }).limit(200)
      if (error) throw error

      setCategoryTx((data ?? []) as TransactionRowEN[])
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
    if (dateRange.start || dateRange.end) return `Período: ${dateRange.start ?? '...'} até ${dateRange.end ?? '...'}`
    return 'Período: todos os registros'
  }, [month, dateRange.start, dateRange.end])

  const YoYBadge = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-xs text-gray-500">YoY: —</span>
    const positive = value >= 0
    return (
      <span className={`text-xs font-medium flex items-center gap-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>
        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {positive ? '+' : ''}
        {value}% vs ano anterior
      </span>
    )
  }

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
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])

      // força estilo estável (evita blur em alguns browsers)
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

      // Ajuste proporcional
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = position - pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
        heightLeft -= pageHeight
      }

      const nameSafe = `relatorio-${(month || 'periodo').replace(/[^\w-]/g, '_')}.pdf`
      pdf.save(nameSafe)
    } catch (e) {
      console.error('Erro ao exportar PDF:', e)
      alert('Não foi possível exportar o PDF. Tente novamente.')
    } finally {
      setExportingPdf(false)
    }
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
        {/* Tudo que estiver dentro desse wrapper será “printado” no PDF */}
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
                <div className="text-2xl font-bold text-white mb-2">{formatCurrencyBRL(kpis.income)}</div>
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
                <div className="text-2xl font-bold text-white mb-2">{formatCurrencyBRL(kpis.expense)}</div>
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
                <div className="text-2xl font-bold text-white mb-2">{formatCurrencyBRL(kpis.balance)}</div>
                <YoYBadge value={yoy.balancePct} />
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-sm">🏆 Melhor Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-white">
                  {bestAndWorst.best ? (
                    <>
                      <div className="font-semibold text-gray-300">{bestAndWorst.best.label}</div>
                      <div className="text-2xl font-bold text-green-400">{formatCurrencyBRL(bestAndWorst.best.balance)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        R: {formatCurrencyBRL(bestAndWorst.best.income)} | D: {formatCurrencyBRL(bestAndWorst.best.expense)}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500">Sem dados no período</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-sm">📉 Performance mais Baixa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-white">
                  {bestAndWorst.worst ? (
                    <>
                      <div className="font-semibold text-gray-300">{bestAndWorst.worst.label}</div>
                      <div className="text-2xl font-bold text-red-400">{formatCurrencyBRL(bestAndWorst.worst.balance)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        R: {formatCurrencyBRL(bestAndWorst.worst.income)} | D: {formatCurrencyBRL(bestAndWorst.worst.expense)}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500">Sem dados no período</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-8">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">📈 Evolução do Saldo por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length === 0 ? (
                  <div className="text-gray-500 py-10 text-center">Sem dados para exibir neste período.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                        tickFormatter={(v) => formatCompactBRL(Number(v))}
                      />
                      <ReferenceLine y={0} stroke="#334155" strokeDasharray="6 6" />
                      <Tooltip
                        contentStyle={{
                          background: '#0b1220',
                          border: '1px solid #243244',
                          color: '#fff',
                          borderRadius: '10px',
                        }}
                        formatter={(v: unknown) => formatCurrencyBRL(Number(v))}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">📊 Receitas vs Despesas por Mês</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyData.length === 0 ? (
                    <div className="text-gray-500 py-10 text-center">Sem dados para exibir neste período.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barGap={6}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <YAxis
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          tickFormatter={(v) => formatCompactBRL(Number(v))}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#0b1220',
                            border: '1px solid #243244',
                            color: '#fff',
                            borderRadius: '10px',
                          }}
                          formatter={(v: unknown) => formatCurrencyBRL(Number(v))}
                        />
                        <Legend
                          wrapperStyle={{ color: '#cbd5e1' }}
                          formatter={(value) => <span className="text-sm text-gray-200">{value}</span>}
                        />
                        <Bar dataKey="income" fill="#22c55e" name="Receitas" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="expense" fill="#fb7185" name="Despesas" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-amber-600" />
                    Gastos por Categoria
                  </CardTitle>
                  <p className="text-gray-400 text-sm">Clique em uma categoria para ver as transações</p>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <div className="text-gray-500 py-10 text-center">Sem despesas no período selecionado.</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                            onClick={(entry: unknown) => {
                              const e = entry as { name?: string }
                              if (e?.name) void openCategory(e.name)
                            }}
                            className="cursor-pointer"
                          >
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>

                          <Tooltip
                            contentStyle={{
                              background: '#0b1220',
                              border: '1px solid #243244',
                              color: '#fff',
                              borderRadius: '10px',
                            }}
                            formatter={(v: unknown, _n: unknown, p: unknown) => {
                              const payload = (p as { payload?: { name?: string; percent?: number } })?.payload
                              const name = payload?.name
                              const percent = payload?.percent
                              const suffix = typeof percent === 'number' ? ` (${percent.toFixed(1)}%)` : ''
                              return [`${formatCurrencyBRL(Number(v))}${suffix}`, name]
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="mt-6 space-y-2">
                        {categoryData.slice(0, 8).map((c) => (
                          <button
                            key={c.name}
                            onClick={() => void openCategory(c.name)}
                            className="w-full flex items-center justify-between gap-3 bg-gray-800/30 hover:bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
                          >
                            <span className="text-sm text-gray-200 truncate font-medium">{c.name}</span>
                            <div className="flex items-center gap-2 text-right">
                              <span className="text-xs text-gray-400">{(c.percent ?? 0).toFixed(1)}%</span>
                              <span className="text-sm text-white font-bold">{formatCurrencyBRL(c.value)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </div>

        {/* Modal - transações da categoria (não entra no PDF por estar fora do reportRef) */}
        {selectedCategory && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeCategory} />
            <div className="relative w-[95vw] max-w-4xl max-h-[85vh] rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <div className="text-xl font-bold text-white">Transações: {selectedCategory}</div>
                <Button variant="outline" onClick={closeCategory} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                  Fechar
                </Button>
              </div>

              <div className="p-6">
                {categoryTxLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-3 text-amber-600">
                      <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                      <span>Carregando transações...</span>
                    </div>
                  </div>
                ) : categoryTx.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg">Nenhuma transação encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-auto pr-2">
                    <div className="text-sm text-gray-400 mb-4">
                      <strong>{categoryTx.length}</strong> transação(ões) • Total:{' '}
                      <strong className="text-red-400">
                        {formatCurrencyBRL(categoryTx.reduce((sum, t) => sum + Number(t.amount || 0), 0))}
                      </strong>
                    </div>

                    {categoryTx.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start justify-between gap-4 rounded-xl border border-gray-800 bg-gray-950/30 px-4 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-medium mb-1 truncate">{t.description || 'Sem descrição'}</div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>📅 {new Date(t.date).toLocaleDateString('pt-BR')}</div>
                            <div>🏷️ {t.category || 'Outros'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-400">- {formatCurrencyBRL(Number(t.amount || 0))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
