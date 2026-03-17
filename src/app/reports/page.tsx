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

function normalizeDateOnly(value?: string | null) {
  if (!value) return ''
  const str = String(value).trim()

  if (str.includes('T')) return str.split('T')[0]
  if (str.includes(' ')) return str.split(' ')[0]
  if (str.includes('/')) {
    const parts = str.split('/')
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      }
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      }
    }
  }

  return str.slice(0, 10).replace(/\//g, '-')
}

function formatDateBR(dateString?: string | null) {
  const onlyDate = normalizeDateOnly(dateString)
  if (!onlyDate) return '-'
  const [year, month, day] = onlyDate.split('-')
  if (!year || !month || !day) return onlyDate
  return `${day}/${month}/${year}`
}

function addOneYearBack(isoDate: string) {
  const [y, m, d] = normalizeDateOnly(isoDate).split('-').map(Number)
  const dt = new Date(y - 1, (m || 1) - 1, d || 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function monthKeyFromISO(iso: string) {
  return normalizeDateOnly(iso).slice(0, 7)
}

function monthLabelPT(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${months[(m || 1) - 1]}/${y}`
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
  const { userId, loading: authLoading } = useAuth()

  const [draftMonth, setDraftMonth] = useState('')
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')

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

  useEffect(() => {
    if (authLoading || !userId || !supabase) return
    void refreshAll()
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
    } catch {
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
    } catch {
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
    } catch {
      setKpis({ income: 0, expense: 0, balance: 0 })
      setYoy({ incomePct: null, expensePct: null, balancePct: null })
    }
  }

  const bestAndWorst = useMemo(() => {
    if (!monthlyData.length) {
      return { best: null as MonthlyData | null, worst: null as MonthlyData | null }
    }
    const sorted = [...monthlyData].sort((a, b) => b.balance - a.balance)
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [monthlyData])

  const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#f43f5e', '#06b6d4', '#a855f7', '#10b981']

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

      setCategoryTx(
        ((data ?? []) as TransactionRowEN[]).map((t) => ({
          ...t,
          date: normalizeDateOnly(t.date),
        })),
      )
    } catch {
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
      return `Período: ${formatDateBR(dateRange.start)} até ${formatDateBR(dateRange.end)}`
    }
    return 'Período: todos os registros'
  }, [month, dateRange.start, dateRange.end])

  const YoYBadge = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-xs text-slate-500">YoY: —</span>
    const positive = value >= 0
    return (
      <span className={`flex items-center gap-1 text-xs font-medium ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
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
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#07090d',
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
        position = position - pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
        heightLeft -= pageHeight
      }

      const nameSafe = `relatorio-${(month || 'periodo').replace(/[^\w-]/g, '_')}.pdf`
      pdf.save(nameSafe)
    } catch {
      alert('Não foi possível exportar o PDF. Tente novamente.')
    } finally {
      setExportingPdf(false)
    }
  }

  if (!supabase) {
    return (
      <div className="bg-app min-h-screen">
        <Navigation />
        <main className="app-shell">
          <div className="premium-panel p-8 text-slate-300">Supabase não configurado.</div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-app min-h-screen">
      <Navigation />

      <main className="app-shell">
        <div ref={reportRef}>
          <section className="page-header">
            <div>
              <div className="premium-chip mb-4">Inteligência financeira</div>
              <h1 className="page-title">Relatórios financeiros</h1>
              <p className="page-subtitle">{filterLabel}</p>
            </div>

            <Button type="button" variant="outline" onClick={exportPDF} disabled={exportingPdf}>
              <Download className="mr-2 h-4 w-4" />
              {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
            </Button>
          </section>

          <section className="premium-panel mb-8 p-6">
            <div className="mb-5">
              <h2 className="section-title">Filtros</h2>
              <p className="section-subtitle">Selecione mês ou intervalo de datas</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Mês</Label>
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
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Data inicial</Label>
                <Input
                  type="date"
                  value={draftStartDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setDraftStartDate(v)
                    if (v) setDraftMonth('')
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Data final</Label>
                <Input
                  type="date"
                  value={draftEndDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setDraftEndDate(v)
                    if (v) setDraftMonth('')
                  }}
                />
              </div>

              <div className="flex items-end gap-3">
                <Button type="button" onClick={applyFilters} disabled={Boolean(dateError)}>
                  <Filter className="mr-2 h-4 w-4" />
                  Aplicar
                </Button>

                <Button type="button" variant="outline" onClick={clearFilters}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>{dateError ? <div className="text-sm text-rose-400">{dateError}</div> : null}</div>

              {isLoading ? (
                <div className="flex items-center gap-2 text-blue-300">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                  <span className="text-sm">Atualizando relatórios...</span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                  Receitas do período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 text-3xl font-bold text-white">{formatCurrencyBRL(kpis.income)}</div>
                <YoYBadge value={yoy.incomePct} />
              </CardContent>
            </Card>

            <Card className="border border-rose-500/15 bg-gradient-to-br from-rose-500/10 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-rose-400">
                  <TrendingDown className="h-4 w-4" />
                  Despesas do período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 text-3xl font-bold text-white">{formatCurrencyBRL(kpis.expense)}</div>
                <YoYBadge value={yoy.expensePct} />
              </CardContent>
            </Card>

            <Card className="border border-blue-500/15 bg-gradient-to-br from-blue-500/10 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-blue-400">
                  <DollarSign className="h-4 w-4" />
                  Saldo líquido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 text-3xl font-bold text-white">{formatCurrencyBRL(kpis.balance)}</div>
                <YoYBadge value={yoy.balancePct} />
              </CardContent>
            </Card>
          </section>

          <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🏆 Melhor performance</CardTitle>
              </CardHeader>
              <CardContent>
                {bestAndWorst.best ? (
                  <>
                    <div className="font-semibold text-slate-300">{bestAndWorst.best.label}</div>
                    <div className="mt-2 text-3xl font-bold text-emerald-400">
                      {formatCurrencyBRL(bestAndWorst.best.balance)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      R: {formatCurrencyBRL(bestAndWorst.best.income)} • D:{' '}
                      {formatCurrencyBRL(bestAndWorst.best.expense)}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">Sem dados no período</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">📉 Performance mais baixa</CardTitle>
              </CardHeader>
              <CardContent>
                {bestAndWorst.worst ? (
                  <>
                    <div className="font-semibold text-slate-300">{bestAndWorst.worst.label}</div>
                    <div className="mt-2 text-3xl font-bold text-rose-400">
                      {formatCurrencyBRL(bestAndWorst.worst.balance)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      R: {formatCurrencyBRL(bestAndWorst.worst.income)} • D:{' '}
                      {formatCurrencyBRL(bestAndWorst.worst.expense)}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">Sem dados no período</div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>📈 Evolução do saldo por mês</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">Sem dados para exibir neste período.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => formatCompactBRL(Number(v))} />
                      <ReferenceLine y={0} stroke="rgba(148,163,184,0.22)" strokeDasharray="6 6" />
                      <Tooltip
                        contentStyle={{
                          background: '#111827',
                          border: '1px solid rgba(148,163,184,0.12)',
                          color: '#fff',
                          borderRadius: '16px',
                        }}
                        formatter={(v: unknown) => formatCurrencyBRL(Number(v))}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>📊 Receitas vs despesas por mês</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthlyData.length === 0 ? (
                    <div className="py-10 text-center text-slate-500">Sem dados para exibir neste período.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barGap={6}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => formatCompactBRL(Number(v))} />
                        <Tooltip
                          contentStyle={{
                            background: '#111827',
                            border: '1px solid rgba(148,163,184,0.12)',
                            color: '#fff',
                            borderRadius: '16px',
                          }}
                          formatter={(v: unknown) => formatCurrencyBRL(Number(v))}
                        />
                        <Legend
                          wrapperStyle={{ color: '#cbd5e1' }}
                          formatter={(value) => <span className="text-sm text-slate-200">{value}</span>}
                        />
                        <Bar dataKey="income" fill="#22c55e" name="Receitas" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="expense" fill="#f43f5e" name="Despesas" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-violet-400" />
                    Gastos por categoria
                  </CardTitle>
                  <p className="text-sm text-slate-400">Clique em uma categoria para ver as transações</p>
                </CardHeader>

                <CardContent>
                  {categoryData.length === 0 ? (
                    <div className="py-10 text-center text-slate-500">Sem despesas no período selecionado.</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={72}
                            outerRadius={110}
                            paddingAngle={3}
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
                              background: '#111827',
                              border: '1px solid rgba(148,163,184,0.12)',
                              color: '#fff',
                              borderRadius: '16px',
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
                            className="premium-panel-soft flex w-full items-center justify-between gap-3 p-4 text-left"
                          >
                            <span className="truncate text-sm font-medium text-slate-200">{c.name}</span>
                            <div className="flex items-center gap-2 text-right">
                              <span className="text-xs text-slate-400">{(c.percent ?? 0).toFixed(1)}%</span>
                              <span className="text-sm font-bold text-white">{formatCurrencyBRL(c.value)}</span>
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

        {selectedCategory ? (
          <div className="fixed inset-0 z-[999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeCategory} />
            <div className="relative max-h-[85vh] w-[95vw] max-w-4xl rounded-[28px] border border-white/10 bg-[#101722] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 p-6">
                <div className="text-xl font-bold text-white">Transações: {selectedCategory}</div>
                <Button variant="outline" onClick={closeCategory}>
                  Fechar
                </Button>
              </div>

              <div className="p-6">
                {categoryTxLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="flex items-center gap-3 text-blue-300">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                      <span>Carregando transações...</span>
                    </div>
                  </div>
                ) : categoryTx.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <p className="text-lg">Nenhuma transação encontrada</p>
                  </div>
                ) : (
                  <div className="scrollbar-thin-dark max-h-[50vh] space-y-3 overflow-auto pr-2">
                    <div className="mb-4 text-sm text-slate-400">
                      <strong>{categoryTx.length}</strong> transação(ões) • Total:{' '}
                      <strong className="text-rose-400">
                        {formatCurrencyBRL(categoryTx.reduce((sum, t) => sum + Number(t.amount || 0), 0))}
                      </strong>
                    </div>

                    {categoryTx.map((t) => (
                      <div
                        key={t.id}
                        className="premium-panel-soft flex items-start justify-between gap-4 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 truncate font-medium text-white">
                            {t.description || 'Sem descrição'}
                          </div>
                          <div className="space-y-1 text-xs text-slate-500">
                            <div>📅 {formatDateBR(t.date)}</div>
                            <div>🏷️ {t.category || 'Outros'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-rose-400">
                            - {formatCurrencyBRL(Number(t.amount || 0))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
