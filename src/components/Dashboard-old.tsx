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
  category: string
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
        fetchTransactions()
        fetchSummary()
      } else {
        setIsLoading(false)
      }
    }
  }, [authLoading, userId])

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
        setTransactions(data)
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
      // Calcular resumo do mês atual
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type, category')
        .eq('user_id', userId)
        .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])

      if (error) {
        console.error('Erro ao buscar resumo:', error)
      } else if (data) {
        const income = data.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
        const expense = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
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

    // Validação básica
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
        const { error } = await supabase
          .from('transactions')
          .update({
            amount: parseFloat(formData.amount),
            type: formData.type,
            category: formData.category,
            description: formData.description,
            date: formData.date
          })
          .eq('id', editingId)

        if (error) {
          console.error('Erro ao atualizar transação:', error)
          alert(`Erro ao atualizar transação: ${error.message}`)
        } else {
          setEditingId(null)
          setShowAddForm(false)
          setFormData({ amount: '', type: 'expense', category: '', description: '', date: new Date().toISOString().split('T')[0] })
          fetchTransactions()
          fetchSummary()
        }
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([{
            user_id: userId,
            amount: parseFloat(formData.amount),
            type: formData.type,
            category: formData.category,
            description: formData.description,
            date: formData.date
          }])

        if (error) {
          console.error('Erro ao adicionar transação:', error)
          alert(`Erro ao adicionar transação: ${error.message}`)
        } else {
          // Reset form
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
      category: t.category,
      description: t.description,
      date: t.date.split('T')[0]
    })
    setShowAddForm(true)
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-yellow-800">⚠️ Configuração Necessária</CardTitle>
              <CardDescription className="text-yellow-700">
                O Supabase não está configurado. Por favor, configure as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Supabase não está configurado. Verifique suas variáveis de ambiente.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!authLoading && !userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Você não está autenticado. Por favor, faça login.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Página inicial</h1>
            <p className="text-gray-600 mt-1">Gerencie suas finanças de forma inteligente</p>
          </div>
          <Button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Transação
          </Button>
        </div>

        {/* Add Transaction Form */}
        {showAddForm && (
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle>Adicionar Transação</CardTitle>
              <CardDescription>Registre uma nova receita ou despesa</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      placeholder="Ex: Alimentação, Salário..."
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    placeholder="Descrição da transação"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                    Adicionar
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                R$ {summary.totalIncome.toFixed(2)}
              </div>
              <p className="text-xs text-green-100 mt-1">Mês atual</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                R$ {summary.totalExpense.toFixed(2)}
              </div>
              <p className="text-xs text-red-100 mt-1">Mês atual</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                R$ {summary.balance.toFixed(2)}
              </div>
              <p className="text-xs text-blue-100 mt-1">Receitas - Despesas</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Transações Recentes
            </CardTitle>
            <CardDescription>Últimas 10 transações registradas</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhuma transação registrada ainda.</p>
                <p className="text-sm mt-2">Clique em "Nova Transação" para começar!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div 
                    key={transaction.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors gap-2"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          transaction.type === 'income' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>
                        <span className="text-sm text-gray-600">{transaction.category}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{transaction.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-lg font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.type === 'income' ? '+' : '-'} R$ {transaction.amount.toFixed(2)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEditTransaction(transaction)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteTransaction(transaction.id)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
