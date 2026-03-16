'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Edit, Plus, Search, Trash2, Wallet, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Navigation } from '@/components/Navigation'
import { AppStatCard } from '@/components/AppStatCard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/hooks/useToast'

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  category?: string | null
  category_id?: string | null
  description: string
  date: string
  payment_method: string
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-app" />}>
      <TransactionsContent />
    </Suspense>
  )
}

function TransactionsContent() {
  const { userId, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const initializedFromQuery = useRef(false)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
  })

  const dateRange = useMemo(() => {
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

    return {
      start: startDate || null,
      end: endDate || null,
    }
  }, [month, startDate, endDate])

  useEffect(() => {
    if (initializedFromQuery.current) return

    const category = searchParams.get('category')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const monthParam = searchParams.get('month')

    if (category) setCategoryFilter(category)
    if (monthParam) {
      setMonth(monthParam)
    } else {
      if (start) setStartDate(start)
      if (end) setEndDate(end)
    }

    initializedFromQuery.current = true
  }, [searchParams])

  useEffect(() => {
    if (authLoading || !userId) return
    fetchProfileCurrency()
    fetchCategories()
    fetchTransactions()
  }, [authLoading, userId, typeFilter, dateRange.start, dateRange.end])

  const fetchProfileCurrency = async () => {
    if (!supabase || !userId) return
    const { data } = await supabase.from('users').select('currency').eq('id', userId).single()
    if (data?.currency) setCurrency(data.currency)
  }

  const fetchCategories = async () => {
    if (!supabase || !userId) return

    try {
      const { data } = await supabase.from('categories').select('id, name').eq('user_id', userId)

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

  const fetchTransactions = async () => {
    if (!supabase || !userId) {
      toast({ title: 'Erro', description: 'Supabase não configurado', variant: 'destructive' })
      return
    }

    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (typeFilter !== 'all') query = query.eq('type', typeFilter)
      if (dateRange.start) query = query.gte('date', dateRange.start)
      if (dateRange.end) query = query.lte('date', dateRange.end)

      const { data, error } = await query

      if (error) {
        toast({
          title: 'Erro',
          description: error.message || 'Falha ao buscar transações',
          variant: 'destructive',
        })
      } else {
        setTransactions((data || []) as Transaction[])
      }
    } catch {
      toast({ title: 'Erro', description: 'Falha ao buscar transações', variant: 'destructive' })
    }
  }

  const getCategoryName = (transaction: Transaction) => {
    return transaction.category || categoriesMap[transaction.category_id || ''] || ''
  }

  const visibleTransactions = useMemo(() => {
    let rows = [...transactions]

    if (categoryFilter.trim()) {
      const term = categoryFilter.trim().toLowerCase()
      rows = rows.filter((t) => getCategoryName(t).toLowerCase().includes(term))
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      rows = rows.filter((t) => {
        const categoryName = getCategoryName(t).toLowerCase()
        const description = (t.description || '').toLowerCase()
        return description.includes(term) || categoryName.includes(term)
      })
    }

    return rows
  }, [transactions, categoryFilter, search])

  const totals = useMemo(() => {
    const income = visibleTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    const expense = visibleTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    return {
      income,
      expense,
      balance: income - expense,
      count: visibleTransactions.length,
    }
  }, [visibleTransactions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !userId) {
      toast({ title: 'Erro', description: 'Sessão inválida', variant: 'destructive' })
      return
    }

    try {
      if (editingId) {
        const updateResult = await supabase
          .from('transactions')
          .update({
            amount: parseFloat(formData.amount),
            type: formData.type,
            category: formData.category,
            description: formData.description,
            date: formData.date,
            payment_method: formData.payment_method,
          })
          .eq('id', editingId)

        if (updateResult.error) {
          if (isMissingColumnError(updateResult.error, 'category')) {
            const categoryId = await getOrCreateCategory(formData.category, formData.type)

            await supabase
              .from('transactions')
              .update({
                amount: parseFloat(formData.amount),
                type: formData.type,
                category_id: categoryId,
                description: formData.description,
                date: formData.date,
                payment_method: formData.payment_method,
              })
              .eq('id', editingId)
          } else {
            throw updateResult.error
          }
        }
      } else {
        const insertResult = await supabase.from('transactions').insert([
          {
            user_id: userId,
            amount: parseFloat(formData.amount),
            type: formData.type,
            category: formData.category,
            description: formData.description,
            date: formData.date,
            payment_method: formData.payment_method,
          },
        ])

        if (insertResult.error) {
          if (isMissingColumnError(insertResult.error, 'category')) {
            const categoryId = await getOrCreateCategory(formData.category, formData.type)

            await supabase.from('transactions').insert([
              {
                user_id: userId,
                amount: parseFloat(formData.amount),
                type: formData.type,
                category_id: categoryId,
                description: formData.description,
                date: formData.date,
                payment_method: formData.payment_method,
              },
            ])
          } else {
            throw insertResult.error
          }
        }
      }

      resetForm()
      fetchTransactions()
      toast({ title: 'Sucesso', description: 'Transação salva com sucesso' })
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao salvar transação',
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setFormData({
      amount: '',
      type: 'expense',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    if (!confirm('Tem certeza que deseja deletar esta transação?')) return

    try {
      await supabase.from('transactions').delete().eq('id', id)
      fetchTransactions()
      toast({ title: 'Sucesso', description: 'Transação removida com sucesso' })
    } catch {
      toast({ title: 'Erro', description: 'Erro ao deletar transação', variant: 'destructive' })
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setFormData({
      amount: transaction.amount.toString(),
      type: transaction.type,
      category: getCategoryName(transaction) || '',
      description: transaction.description,
      date: transaction.date.split('T')[0],
      payment_method: transaction.payment_method,
    })
    setEditingId(transaction.id)
    setShowForm(true)
  }

  const getOrCreateCategory = async (name: string, type: 'income' | 'expense') => {
    if (!name.trim() || !supabase || !userId) return null

    try {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name.trim())
        .eq('type', type)
        .single()

      if (existing?.id) return existing.id

      const { data: created } = await supabase
        .from('categories')
        .insert([{ user_id: userId, name: name.trim(), type }])
        .select('id')
        .single()

      return created?.id || null
    } catch {
      return null
    }
  }

  const isMissingColumnError = (error: any, column: string) => {
    const message = (error?.message || '').toLowerCase()
    return (
      message.includes(`column \"${column}\"`) ||
      message.includes(`column "${column}"`) ||
      message.includes('does not exist')
    )
  }

  return (
    <div className="min-h-screen bg-app">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="premium-chip mb-4">Histórico financeiro</div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Transações</h1>
            <p className="mt-2 text-slate-400">Gerencie receitas e despesas em um só lugar</p>
          </div>

          <Button
            onClick={() => setShowForm(!showForm)}
            className="rounded-2xl border-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 px-6 py-3 text-white hover:opacity-95"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nova Transação
          </Button>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AppStatCard
            title="Total de registros"
            value={totals.count}
            subtitle="Transações filtradas"
            icon={Wallet}
          />
          <AppStatCard
            title="Receitas"
            value={formatCurrency(totals.income, currency)}
            subtitle="Entradas do período"
            icon={ArrowUpCircle}
            valueClassName="text-emerald-400"
          />
          <AppStatCard
            title="Despesas"
            value={formatCurrency(totals.expense, currency)}
            subtitle="Saídas do período"
            icon={ArrowDownCircle}
            valueClassName="text-rose-400"
          />
          <AppStatCard
            title="Saldo"
            value={formatCurrency(totals.balance, currency)}
            subtitle="Resultado dos filtros"
            icon={Wallet}
            valueClassName={totals.balance >= 0 ? 'text-amber-400' : 'text-red-400'}
          />
        </section>

        <section className="premium-panel mb-8 p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-white">Filtros</h2>
            <p className="mt-1 text-sm text-slate-400">Refine a visualização das transações</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Categoria</Label>
              <Input
                placeholder="Ex: Barbearia, Loja, Pessoal"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Descrição ou categoria"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 rounded-2xl border-white/10 bg-slate-950/50 pl-10 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Mês</Label>
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
                className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Tipo</Label>
              <Select
                value={typeFilter}
                onValueChange={(value: 'all' | 'income' | 'expense') => setTypeFilter(value)}
              >
                <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-white">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Data inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
                className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
                className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCategoryFilter('')
                setSearch('')
                setTypeFilter('all')
                setMonth('')
                setStartDate('')
                setEndDate('')
              }}
              className="rounded-2xl border-white/10 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
            >
              Limpar filtros
            </Button>
          </div>
        </section>

        {showForm ? (
          <section className="premium-panel mb-8 p-6">
            <h2 className="mb-6 text-2xl font-bold text-white">
              {editingId ? 'Editar transação' : 'Adicionar transação'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'income' | 'expense') =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Categoria</Label>
                  <Input
                    placeholder="Ex: Alimentação, Salário..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Método de pagamento</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Data</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Descrição</Label>
                <Input
                  placeholder="Descrição da transação"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  className="rounded-2xl border-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 px-6 py-3 text-white hover:opacity-95"
                >
                  {editingId ? 'Atualizar' : 'Adicionar'}
                </Button>

                <Button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-3 text-slate-200 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="premium-panel overflow-hidden">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-xl font-semibold text-white">Lista de transações</h2>
            <p className="mt-1 text-sm text-slate-400">Movimentações encontradas com os filtros atuais</p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-white/10 bg-white/5">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="py-4 text-slate-300">Data</TableHead>
                  <TableHead className="text-slate-300">Descrição</TableHead>
                  <TableHead className="text-slate-300">Categoria</TableHead>
                  <TableHead className="text-slate-300">Método</TableHead>
                  <TableHead className="text-right text-slate-300">Valor</TableHead>
                  <TableHead className="text-right text-slate-300">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {visibleTransactions.length === 0 ? (
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                      Nenhuma transação registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      className="border-white/5 hover:bg-white/[0.03]"
                    >
                      <TableCell className="py-4 text-slate-300">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-white">{transaction.description || '-'}</TableCell>
                      <TableCell className="text-slate-300 capitalize">
                        {getCategoryName(transaction) || '-'}
                      </TableCell>
                      <TableCell className="text-slate-300 capitalize">
                        {formatPaymentMethod(transaction.payment_method)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          transaction.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}{' '}
                        {formatCurrency(transaction.amount, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(transaction)}
                            className="h-9 w-9 rounded-xl border-white/10 bg-slate-900/70 p-2 text-slate-300 hover:bg-slate-800 hover:text-blue-300"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(transaction.id)}
                            className="h-9 w-9 rounded-xl border-white/10 bg-slate-900/70 p-2 text-slate-300 hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </div>
  )
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number(value) || 0)
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case 'pix':
      return 'PIX'
    case 'card':
      return 'Cartão'
    case 'transfer':
      return 'Transferência'
    case 'cash':
      return 'Dinheiro'
    default:
      return method
  }
}
