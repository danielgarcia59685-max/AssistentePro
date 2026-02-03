'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Edit, Trash2, Plus } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Navigation } from '@/components/Navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'

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
    <Suspense fallback={<div className="min-h-screen bg-black" />}> 
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

  const fetchTransactions = async () => {
    if (!supabase || !userId) {
      console.warn('Supabase não está configurado')
      toast({ title: 'Erro', description: 'Supabase não configurado', variant: 'destructive' })
      return
    }
    
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter)
      }

      if (dateRange.start) {
        query = query.gte('date', dateRange.start)
      }

      if (dateRange.end) {
        query = query.lte('date', dateRange.end)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar transações:', error)
        toast({ title: 'Erro', description: error.message || 'Falha ao buscar transações', variant: 'destructive' })
      } else {
        setTransactions((data || []) as Transaction[])
      }
    } catch (error) {
      console.error('Erro ao buscar transações:', error)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !userId) {
      toast({ title: 'Erro', description: 'Sessão inválida', variant: 'destructive' })
      return
    }

    try {
      if (editingId) {
        // Atualizar transação existente
        const updateResult = await supabase.from('transactions').update({
          amount: parseFloat(formData.amount),
          type: formData.type,
          category: formData.category,
          description: formData.description,
          date: formData.date,
          payment_method: formData.payment_method,
        }).eq('id', editingId)

        if (updateResult.error) {
          if (isMissingColumnError(updateResult.error, 'category')) {
            const categoryId = await getOrCreateCategory(formData.category, formData.type)
            await supabase.from('transactions').update({
              amount: parseFloat(formData.amount),
              type: formData.type,
              category_id: categoryId,
              description: formData.description,
              date: formData.date,
              payment_method: formData.payment_method,
            }).eq('id', editingId)
          } else {
            throw updateResult.error
          }
        }
      } else {
        // Inserir nova transação
        const insertResult = await supabase.from('transactions').insert([{
          user_id: userId,
          amount: parseFloat(formData.amount),
          type: formData.type,
          category: formData.category,
          description: formData.description,
          date: formData.date,
          payment_method: formData.payment_method,
        }])

        if (insertResult.error) {
          if (isMissingColumnError(insertResult.error, 'category')) {
            const categoryId = await getOrCreateCategory(formData.category, formData.type)
            await supabase.from('transactions').insert([{
              user_id: userId,
              amount: parseFloat(formData.amount),
              type: formData.type,
              category_id: categoryId,
              description: formData.description,
              date: formData.date,
              payment_method: formData.payment_method,
            }])
          } else {
            throw insertResult.error
          }
        }
      }
      
      resetForm()
      fetchTransactions()
    } catch (error: any) {
      console.error('Erro ao salvar transação:', error)
      toast({ title: 'Erro', description: error?.message || 'Falha ao salvar transação', variant: 'destructive' })
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
    } catch (err) {
      console.error('Erro ao deletar transação:', err)
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
    } catch (error) {
      console.warn('Categorias não disponíveis:', error)
      return null
    }
  }

  const isMissingColumnError = (error: any, column: string) => {
    const message = (error?.message || '').toLowerCase()
    return message.includes(`column \"${column}\"`) || message.includes(`column "${column}"`) || message.includes('does not exist')
  }


  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Transações</h1>
            <p className="text-gray-400">Histórico completo de todas as transações</p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova Transação
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300 font-semibold">Categoria</Label>
              <Input
                placeholder="Ex: Barbearia, Loja, Pessoal"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 font-semibold">Pesquisar</Label>
              <Input
                placeholder="Descrição ou categoria"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 font-semibold">Mês</Label>
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
              <Label className="text-gray-300 font-semibold">Tipo</Label>
              <Select value={typeFilter} onValueChange={(value: 'all' | 'income' | 'expense') => setTypeFilter(value)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 rounded-xl text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label className="text-gray-300 font-semibold">Data inicial</Label>
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
              <Label className="text-gray-300 font-semibold">Data final</Label>
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
          <div className="flex gap-3 mt-4">
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
            >
              Limpar filtros
            </Button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">{editingId ? 'Editar' : 'Adicionar'} Transação</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Tipo</Label>
                  <Select value={formData.type} onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value })}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 rounded-xl text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Categoria</Label>
                  <Input
                    placeholder="Ex: Alimentação, Salário..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Método de Pagamento</Label>
                  <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 rounded-xl text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Data</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 font-semibold">Descrição</Label>
                <Input
                  placeholder="Descrição da transação"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl transition">
                  {editingId ? 'Atualizar' : 'Adicionar'}
                </Button>
                <Button 
                  type="button" 
                  onClick={resetForm}
                  className="border border-gray-700 text-gray-300 hover:bg-gray-800 px-6 py-3 rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-800/50 border-b border-gray-800">
                <TableRow>
                  <TableHead className="text-gray-300 font-semibold py-4">Data</TableHead>
                  <TableHead className="text-gray-300 font-semibold">Descrição</TableHead>
                  <TableHead className="text-gray-300 font-semibold">Categoria</TableHead>
                  <TableHead className="text-gray-300 font-semibold">Método</TableHead>
                  <TableHead className="text-gray-300 font-semibold text-right">Valor</TableHead>
                  <TableHead className="text-gray-300 font-semibold text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <p className="text-gray-400">Nenhuma transação registrada</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition">
                      <TableCell className="text-gray-300 py-4">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-gray-300">{transaction.description}</TableCell>
                      <TableCell className="text-gray-300 capitalize">{getCategoryName(transaction) || '-'}</TableCell>
                      <TableCell className="text-gray-300 capitalize">{formatPaymentMethod(transaction.payment_method)}</TableCell>
                      <TableCell className={`font-bold text-right ${
                        transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleEdit(transaction)}
                            className="border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-amber-600 hover:border-amber-600/30 p-2 h-9 w-9"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDelete(transaction.id)}
                            className="border-gray-700 text-gray-400 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 p-2 h-9 w-9"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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

function formatPaymentMethod(method: string) {
  switch (method) {
    case 'pix': return 'PIX'
    case 'card': return 'Cartão'
    case 'transfer': return 'Transferência'
    case 'cash': return 'Dinheiro'
    default: return method
  }
}
