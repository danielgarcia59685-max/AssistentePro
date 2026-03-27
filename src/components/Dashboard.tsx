'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTransactions } from '@/context/TransactionsContext'
import { supabase } from '@/lib/supabase'
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
import { Navigation } from './Navigation'
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react'
import type { Transaction } from '@/context/TransactionsContext'

type TxType = 'income' | 'expense'

interface Summary {
  totalIncome: number
  totalExpense: number
  balance: number
}

export default function Dashboard() {
  const { userId, userEmail, logout, loading: authLoading } = useAuth()

  const {
    transactions,
    refreshTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    isLoading: txLoading,
    isConfigured,
  } = useTransactions()

  const [summary, setSummary] = useState<Summary>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  })
  const [pageLoading, setPageLoading] = useState(true)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [currency, setCurrency] = useState('BRL')
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense' as TxType,
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'pix',
    currency: 'BRL',
  })

  useEffect(() => {
    if (!authLoading && userId) {
      if (!supabase) {
        setPageLoading(false)
        return
      }

      void (async () => {
        try {
          await Promise.all([
            fetchProfileCurrency(),
            fetchCategories(),
            fetchSummary(),
            refreshTransactions(),
          ])
        } finally {
          setPageLoading(false)
        }
      })()

      return
    }

    if (!authLoading && !userId) {
      setPageLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId])

  const fetchProfileCurrency = async () => {
    if (!supabase || !userId) return

    const { data, error } = await supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .single()

    if (error) {
      console.warn('Erro ao buscar moeda do perfil:', error.message)
      return
    }

    if (data?.currency) {
      setCurrency(data.currency)
      setFormData((prev) => ({ ...prev, currency: data.currency }))
    }
  }

  const fetchCategories = async () => {
    if (!supabase || !userId) return

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)

      if (error) {
        console.warn('Erro ao buscar categorias:', error.message)
        return
      }

      if (data) {
        const map = data.reduce(
          (acc: Record<string, string>, row: { id: string; name: string }) => {
            acc[row.id] = row.name
            return acc
          },
          {},
        )
        setCategoriesMap(map)
      }
    } catch (error) {
      console.warn('Categorias não disponíveis:', error)
    }
  }

  const fetchSummary = async () => {
    if (!supabase || !userId) return

    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0]

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('user_id', userId)
        .gte('date', startOfMonth)

      if (error) {
        console.error('Erro ao buscar resumo:', error)
        return
      }

      const rows = (data ?? []) as Array<{ amount: number; type: TxType; date: string }>
      const income = rows
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)

      const expense = rows
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)

      setSummary({
        totalIncome: income,
        totalExpense: expense,
        balance: income - expense,
      })
    } catch (error) {
      console.error('Erro ao buscar resumo:', error)
    }
  }

  const getCategoryName = (transaction: Transaction) => {
    const raw = String(transaction.category ?? '').trim()
    if (!raw) return ''
    return categoriesMap[raw] ?? raw
  }

  const resetForm = () => {
    setFormData({
      amount: '',
      type: 'expense',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'pix',
      currency: currency || 'BRL',
    })
    setEditingId(null)
    setShowAddForm(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!userId) {
      alert('Você não está autenticado. Faça login.')
      return
    }

    const amount = Number(formData.amount)

    if (!formData.amount || Number.isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido.')
      return
    }

    if (!formData.category.trim()) {
      alert('Por favor, insira uma categoria.')
      return
    }

    const payload = {
      amount,
      type: formData.type,
      category: formData.category.trim(),
      description: formData.description?.trim() || '',
      date: formData.date,
      payment_method: formData.payment_method,
      currency: formData.currency || currency || 'BRL',
    }

    try {
      if (editingId) {
        await updateTransaction(editingId, payload)
      } else {
        await addTransaction(payload)
      }

      resetForm()
      await refreshTransactions()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao adicionar/atualizar transação:', error)
      alert('Erro ao adicionar/atualizar transação. Tente novamente.')
    }
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingId(transaction.id)
    setFormData({
      amount: String(transaction.amount ?? ''),
      type: (transaction.type as TxType) || 'expense',
      category: getCategoryName(transaction) || '',
      description: transaction.description ?? '',
      date: String(transaction.date ?? '').split('T')[0],
      payment_method: transaction.payment_method || 'pix',
      currency: transaction.currency || currency || 'BRL',
    })
    setShowAddForm(true)
  }

  const handleDeleteTransaction = async (id: string) => {
    const confirmed = window.confirm('Tem certeza que deseja deletar esta transação?')
    if (!confirmed) return

    try {
      await deleteTransaction(id)
      await refreshTransactions()
      await fetchSummary()
    } catch (error) {
      console.error('Erro ao deletar transação:', error)
      alert('Erro ao deletar transação. Tente novamente.')
    }
  }

  const loading = pageLoading || txLoading

  if (!supabase || !isConfigured) {
    return (
      <div className="min-h-screen bg-black p-4 sm:p-6 lg:p-8">
        <Navigation />
        <div className="max-w-7xl mx-auto mt-8">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6">
            <h3 className="text-yellow-400 font-bold">Configuração Necessária</h3>
            <p className="text-gray-400 mt-2">
              O Supabase não está configurado. Configure as variáveis de ambiente no arquivo{' '}
              <code>.env.local</code>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Navigation />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto" />
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
          <p className="text-gray-400 mt-2">
            Você não está autenticado. Por favor, faça login.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Página inicial</h1>
            <p className="text-gray-400">
              Bem-vindo ao AssistentePro{userEmail ? ` (${userEmail})` : ''}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setShowAddForm((prev) => !prev)}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-black font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-amber-600/20"
            >
              <Plus className="w-5 h-5" />
              Nova Transação
            </Button>

            <Button
              variant="outline"
              onClick={() => void logout()}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 px-6 py-3 rounded-xl"
            >
              Sair
            </Button>
          </div>
        </header>

        {showAddForm && (
          <div className="bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-800 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingId ? 'Editar' : 'Adicionar'} Transação
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-gray-200 font-semibold">
                    Valor
                  </Label>
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
                  <Label htmlFor="type" className="text-gray-200 font-semibold">
                    Tipo
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: TxType) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 rounded-lg text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="income" className="text-white">
                        Receita
                      </SelectItem>
                      <SelectItem value="expense" className="text-white">
                        Despesa
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-gray-200 font-semibold">
                    Categoria
                  </Label>
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
                  <Label htmlFor="date" className="text-gray-200 font-semibold">
                    Data
                  </Label>
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
                <Label htmlFor="description" className="text-gray-200 font-semibold">
                  Descrição
                </Label>
                <Input
                  id="description"
                  placeholder="Descrição da transação"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-gray-800 border-gray-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition"
                >
                  {editingId ? 'Atualizar' : 'Adicionar'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 px-6 py-3 rounded-lg"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <SummaryCard
            title="Receitas"
            value={summary.totalIncome}
            currency={currency}
            color="green"
            Icon={TrendingUp}
          />
          <SummaryCard
            title="Despesas"
            value={summary.totalExpense}
            currency={currency}
            color="red"
            Icon={TrendingDown}
          />
          <SummaryCard
            title="Saldo"
            value={summary.balance}
            currency={currency}
            color="amber"
            Icon={DollarSign}
          />
        </section>

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
              transactions.slice(0, 10).map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-gray-900 hover:bg-gray-800 transition p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start md:items-center gap-4 w-full md:w-auto">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        transaction.type === 'income' ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}
                    >
                      {transaction.type === 'income' ? (
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            transaction.type === 'income'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>

                        <h4 className="text-white font-semibold capitalize">
                          {getCategoryName(transaction) || '-'}
                        </h4>
                      </div>

                      <p className="text-gray-400 text-sm mt-1">
                        {transaction.description ?? ''}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto md:justify-end">
                    <span
                      className={`text-lg font-bold ${
                        transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}{' '}
                      {formatCurrency(transaction.amount, currency)}
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
                        onClick={() => void handleDeleteTransaction(transaction.id)}
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

function SummaryCard({
  title,
  value,
  currency,
  color,
  Icon,
}: {
  title: string
  value: number
  currency: string
  color: 'green' | 'red' | 'amber'
  Icon: React.ComponentType<{ className?: string }>
}) {
  const colorMap = {
    green: { text: 'text-green-500', bg: 'bg-green-500/10' },
    red: { text: 'text-red-500', bg: 'bg-red-500/10' },
    amber: { text: 'text-amber-600', bg: 'bg-amber-600/20' },
  } as const

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex justify-between items-center hover:border-gray-700 transition">
      <div>
        <p className="text-gray-400 mb-1 font-medium">{title}</p>
        <h3 className={`text-3xl font-bold ${colorMap[color].text}`}>
          {formatCurrency(value, currency)}
        </h3>
        <p className="text-sm text-gray-500 mt-2">Mês atual</p>
      </div>
      <div
        className={`w-12 h-12 ${colorMap[color].bg} rounded-full flex items-center justify-center`}
      >
        <Icon className={`w-6 h-6 ${colorMap[color].text}`} />
      </div>
    </div>
  )
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number(value) || 0)
}
