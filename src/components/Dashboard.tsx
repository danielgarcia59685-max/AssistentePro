'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Navigation } from './Navigation'
import { Calendar, DollarSign, TrendingUp, TrendingDown, Plus, LogOut, Edit, Trash2 } from 'lucide-react'

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  category?: string | null
  category_id?: string | null
  description: string
  date: string
}

interface Summary {
  totalIncome: number
  totalExpense: number
  balance: number
}

export default function Dashboard() {
  const { userId, userEmail, logout, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary>({ totalIncome: 0, totalExpense: 0, balance: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currency, setCurrency] = useState('BRL')
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({})
  
  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (!authLoading && userId) {
      if (supabase) {
        fetchProfileCurrency()
        fetchCategories()
        fetchTransactions()
        fetchSummary()
      } else {
        setIsLoading(false)
      }
    }
  }, [authLoading, userId])

  const fetchProfileCurrency = async () => {
    if (!supabase || !userId) return
    const { data } = await supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .single()

    if (data?.currency) {
      setCurrency(data.currency)
    }
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
      console.warn('Supabase ou userId não configurado')
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Erro ao buscar transações:', error)
      } else if (data) {
        setTransactions(data as Transaction[])
      }
    } catch (error) {
      console.error('Erro ao buscar transações:', error)
    }
  }

  const fetchSummary = async () => {
    if (!supabase || !userId) {
      console.warn('Supabase ou userId não configurado')
      setIsLoading(false)
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])

      if (error) {
        console.error('Erro ao buscar resumo:', error)
      } else if (data) {
        const income = data.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
        const expense = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)
        setSummary({ totalIncome: income, totalExpense: expense, balance: income - expense })
      }
    } catch (error) {
      console.error('Erro ao buscar resumo:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase || !userId) {
      alert('Erro: Supabase não está configurado ou você não está autenticado.')
      return
    }

    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      alert('Por favor, insira um valor válido.')
      return
    }

    if (!formData.category.trim()) {
      alert('Por favor, insira uma categoria.')
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
            date: formData.date
          })
          .eq('id', editingId)

        if (updateResult.error) {
          if (isMissingColumnError(updateResult.error, 'category')) {
            const categoryId = await getOrCreateCategory(formData.category, formData.type)
            const fallbackResult = await supabase
              .from('transactions')
              .update({
                amount: parseFloat(formData.amount),
                type: formData.type,
                category_id: categoryId,
                description: formData.description,
                date: formData.date
              })
              .eq('id', editingId)

            if (fallbackResult.error) {
              console.error('Erro ao atualizar transação:', fallbackResult.error)
              alert(`Erro ao atualizar transação: ${fallbackResult.error.message}`)
              return
            }
          } else {
            console.error('Erro ao atualizar transação:', updateResult.error)
            alert(`Erro ao atualizar transação: ${updateResult.error.message}`)
            return
          }
        } else {
          setEditingId(null)
          setShowAddForm(false)
          setFormData({ amount: '', type: 'expense', category: '', description: '', date: new Date().toISOString().split('T')[0] })
          fetchTransactions()
          fetchSummary()
        }
      } else {
        const insertResult = await supabase
          .from('transactions')
          .insert([{
            user_id: userId,
            amount: parseFloat(formData.amount),
            type: formData.type,
            category: formData.category,
            description: formData.description,
            date: formData.date
          }])

        if (insertResult.error) {
          if (isMissingColumnError(insertResult.error, 'category')) {
            const categoryId = await getOrCreateCategory(formData.category, formData.type)
            const fallbackResult = await supabase
              .from('transactions')
              .insert([{
                user_id: userId,
                amount: parseFloat(formData.amount),
                type: formData.type,
                category_id: categoryId,
                description: formData.description,
                date: formData.date
              }])

            if (fallbackResult.error) {
              console.error('Erro ao adicionar transação:', fallbackResult.error)
              alert(`Erro ao adicionar transação: ${fallbackResult.error.message}`)
              return
            }
          } else {
            console.error('Erro ao adicionar transação:', insertResult.error)
            alert(`Erro ao adicionar transação: ${insertResult.error.message}`)
            return
          }
        } else {
          setFormData({ amount: '', type: 'expense', category: '', description: '', date: new Date().toISOString().split('T')[0] })
          setShowAddForm(false)
          fetchTransactions()
          fetchSummary()
        }
      }
    } catch (error) {
      console.error('Erro ao adicionar/atualizar transação:', error)
      alert('Erro ao adicionar/atualizar transação. Tente novamente.')
    }
  }

  const handleEditTransaction = (t: Transaction) => {
    setEditingId(t.id)
    setFormData({
      amount: t.amount.toString(),
      type: t.type,
      category: getCategoryName(t) || '',
      description: t.description,
      date: t.date.split('T')[0]
    })
    setShowAddForm(true)
  }

  const getCategoryName = (transaction: Transaction) => {
    return transaction.category || categoriesMap[transaction.category_id || ''] || ''
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

  const handleDeleteTransaction = async (id: string) => {
    if (!supabase) return
    try {
      await supabase.from('transactions').delete().eq('id', id)
      fetchTransactions()
      fetchSummary()
    } catch (err) {
      console.error('Erro ao deletar transação:', err)
    }
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-black p-4 sm:p-6 lg:p-8">
        <Navigation />
        <div className="max-w-7xl mx-auto mt-8">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6">
            <h3 className="text-yellow-400 font-bold">⚠️ Configuração Necessária</h3>
            <p className="text-gray-400 mt-2">O Supabase não está configurado. Por favor, configure as variáveis de ambiente.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Navigation />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!authLoading && !userId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Navigation />
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 max-w-md">
          <h2 className="text-white font-bold text-lg">Erro de Autenticação</h2>
          <p className="text-gray-400 mt-2">Você não está autenticado. Por favor, faça login.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Página inicial</h1>
            <p className="text-gray-400">Bem-vindo ao AssistentePro, seu assistente pessoal</p>
          </div>
          <Button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-black font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-amber-600/20"
          >
            <Plus className="w-5 h-5" />
            Nova Transação
          </Button>
        </header>

        {/* Add Transaction Form */}
        {showAddForm && (
          <div className="bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-800">
            <h2 className="text-2xl font-bold text-white mb-6">{editingId ? 'Editar' : 'Adicionar'} Transação</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-gray-200 font-semibold">Valor</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-gray-200 font-semibold">Tipo</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 rounded-lg text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="income" className="text-white">Receita</SelectItem>
                      <SelectItem value="expense" className="text-white">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-gray-200 font-semibold">Categoria</Label>
                  <Input
                    id="category"
                    placeholder="Ex: Alimentação, Salário..."
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date" className="text-gray-200 font-semibold">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-200 font-semibold">Descrição</Label>
                <Input
                  id="description"
                  placeholder="Descrição da transação"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition">
                  {editingId ? 'Atualizar' : 'Adicionar'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { setShowAddForm(false); setEditingId(null) }}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 px-6 py-3 rounded-lg"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Summary Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Receitas */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex justify-between items-center hover:border-gray-700 transition">
            <div>
              <p className="text-gray-400 mb-1 font-medium">Receitas</p>
              <h3 className="text-3xl font-bold text-green-500">{formatCurrency(summary.totalIncome, currency)}</h3>
              <p className="text-sm text-gray-500 mt-2">Mês atual</p>
            </div>
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
          </div>
          
          {/* Despesas */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex justify-between items-center hover:border-gray-700 transition">
            <div>
              <p className="text-gray-400 mb-1 font-medium">Despesas</p>
              <h3 className="text-3xl font-bold text-red-500">{formatCurrency(summary.totalExpense, currency)}</h3>
              <p className="text-sm text-gray-500 mt-2">Mês atual</p>
            </div>
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
          </div>

          {/* Saldo (Destaque Dourado) */}
          <div className="bg-gray-900 rounded-2xl border border-amber-600/30 p-6 flex justify-between items-center relative overflow-hidden hover:border-amber-600/50 transition">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-amber-600/10 blur-2xl rounded-full"></div>
            <div>
              <p className="text-amber-600 mb-1 font-medium">Saldo</p>
              <h3 className="text-3xl font-bold text-amber-600">{formatCurrency(summary.balance, currency)}</h3>
              <p className="text-sm text-gray-500 mt-2">Receitas - Despesas</p>
            </div>
            <div className="w-12 h-12 bg-amber-600/20 rounded-full flex items-center justify-center z-10">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </section>

        {/* Recent Transactions */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-600" />
            Transações Recentes
          </h2>
          <p className="text-gray-400 mb-4">Últimas 10 transações registradas</p>

          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-900 rounded-2xl border border-gray-800">
                <p className="text-lg">Nenhuma transação registrada ainda.</p>
                <p className="text-sm mt-2">Clique em "Nova Transação" para começar!</p>
              </div>
            ) : (
              transactions.map((transaction) => (
                <div 
                  key={transaction.id}
                  className="bg-gray-900 hover:bg-gray-800 transition p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start md:items-center gap-4 w-full md:w-auto">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      transaction.type === 'income' 
                        ? 'bg-green-500/10' 
                        : 'bg-red-500/10'
                    }`}>
                      {transaction.type === 'income' ? (
                        <TrendingUp className={`w-5 h-5 ${transaction.type === 'income' ? 'text-green-500' : 'text-red-500'}`} />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          transaction.type === 'income' 
                            ? 'bg-green-500/10 text-green-400' 
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>
                        <h4 className="text-white font-semibold capitalize">{getCategoryName(transaction) || '-'}</h4>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{transaction.description}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full md:w-auto md:justify-end">
                    <span className={`text-lg font-bold ${
                      transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount, currency)}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEditTransaction(transaction)}
                        className="border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-amber-600 hover:border-amber-600/30 p-2 h-9 w-9"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        className="border-gray-700 text-gray-400 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 p-2 h-9 w-9"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
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
