'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Navigation } from '@/components/Navigation'
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
import { supabase } from '@/lib/supabase'
import { Target, Plus, Trash2, Edit } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  category: string
  deadline: string
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number(value) || 0)
}

export default function GoalsPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()

  const [goals, setGoals] = useState<Goal[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currency, setCurrency] = useState('BRL')
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    category: 'savings',
    deadline: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
  })

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
    }
  }, [authLoading, userId, router])

  useEffect(() => {
    if (!userId) return
    fetchProfileCurrency()
    fetchGoals()
  }, [userId])

  const fetchProfileCurrency = async () => {
    if (!supabase || !userId) return

    const { data } = await supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .maybeSingle()

    if (data?.currency) setCurrency(data.currency)
  }

  const fetchGoals = async () => {
    if (!supabase || !userId) return

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('financial_goals')
        .select('*')
        .eq('user_id', userId)
        .order('deadline', { ascending: true })

      if (error) throw error
      setGoals((data || []) as Goal[])
    } catch (error: any) {
      console.error('Erro ao buscar metas:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível carregar as metas',
        variant: 'destructive',
      })
      setGoals([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    const { data: sessionData } = await supabase.auth.getSession()
    const sessionUserId = sessionData.session?.user?.id || null

    if (!sessionUserId) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente para salvar a meta',
        variant: 'destructive',
      })
      return
    }

    if (!formData.name.trim()) {
      toast({
        title: 'Nome inválido',
        description: 'Informe um nome para a meta',
        variant: 'destructive',
      })
      return
    }

    if (
      !formData.target_amount ||
      isNaN(Number(formData.target_amount)) ||
      Number(formData.target_amount) <= 0
    ) {
      toast({
        title: 'Valor alvo inválido',
        description: 'Informe um valor alvo maior que 0',
        variant: 'destructive',
      })
      return
    }

    if (formData.current_amount && Number(formData.current_amount) < 0) {
      toast({
        title: 'Valor atual inválido',
        description: 'O valor atual não pode ser negativo',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        name: formData.name.trim(),
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount) || 0,
        category: formData.category,
        deadline: formData.deadline,
      }

      if (editingId) {
        await supabase.from('financial_goals').update(payload).eq('id', editingId).throwOnError()
      } else {
        await supabase
          .from('financial_goals')
          .insert([
            {
              user_id: sessionUserId,
              ...payload,
            },
          ])
          .throwOnError()
      }

      resetForm()
      await fetchGoals()

      toast({
        title: 'Sucesso',
        description: editingId ? 'Meta atualizada com sucesso' : 'Meta criada com sucesso',
      })
    } catch (error: any) {
      console.error('Erro ao salvar meta:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar a meta',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      target_amount: '',
      current_amount: '',
      category: 'savings',
      deadline: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (goal: Goal) => {
    setFormData({
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      category: goal.category,
      deadline: goal.deadline.split('T')[0],
    })
    setEditingId(goal.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!supabase || !window.confirm('Tem certeza que deseja excluir esta meta?')) return

    try {
      await supabase.from('financial_goals').delete().eq('id', id).throwOnError()
      await fetchGoals()
      toast({ title: 'Sucesso', description: 'Meta excluída com sucesso' })
    } catch (error: any) {
      console.error('Erro ao deletar:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível excluir a meta',
        variant: 'destructive',
      })
    }
  }

  const totalGoals = goals.length
  const completedGoals = goals.filter((g) => g.current_amount >= g.target_amount).length
  const totalTargetAmount = goals.reduce((sum, g) => sum + Number(g.target_amount || 0), 0)
  const totalCurrentAmount = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0)

  const progressTotal = useMemo(() => {
    if (totalTargetAmount <= 0) return 0
    return Math.min((totalCurrentAmount / totalTargetAmount) * 100, 100)
  }, [totalCurrentAmount, totalTargetAmount])

  const getProgressPercentage = (goal: Goal) => {
    if (!goal.target_amount || goal.target_amount <= 0) return 0
    return Math.min((goal.current_amount / goal.target_amount) * 100, 100)
  }

  const getStatusColor = (goal: Goal) => {
    if (goal.current_amount >= goal.target_amount) {
      return 'bg-green-500/10 border-green-500/20 text-green-400'
    }

    if (goal.current_amount > 0) {
      return 'bg-amber-600/10 border-amber-600/20 text-amber-400'
    }

    return 'bg-gray-800/50 border-gray-700 text-gray-400'
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Metas Financeiras</h1>
            <p className="text-gray-400">Acompanhe suas metas e objetivos</p>
          </div>

          <Button
            onClick={() => setShowForm((prev) => !prev)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova Meta
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Total de Metas</p>
            <p className="text-3xl font-bold text-white">{totalGoals}</p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Valor Total</p>
            <p className="text-3xl font-bold text-amber-600">
              {formatCurrency(totalTargetAmount, currency)}
            </p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Acumulado</p>
            <p className="text-3xl font-bold text-green-500">
              {formatCurrency(totalCurrentAmount, currency)}
            </p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Concluídas</p>
            <p className="text-3xl font-bold text-blue-500">{completedGoals}</p>
          </div>
        </div>

        {showForm && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300">Nome da Meta</Label>
                  <Input
                    placeholder="Ex: Comprar carro"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="savings">Poupança</SelectItem>
                      <SelectItem value="investment">Investimento</SelectItem>
                      <SelectItem value="vacation">Férias</SelectItem>
                      <SelectItem value="home">Casa</SelectItem>
                      <SelectItem value="car">Carro</SelectItem>
                      <SelectItem value="education">Educação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Valor Alvo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Valor Atual</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.current_amount}
                    onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Data Alvo</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  required
                  className="bg-gray-800 border-gray-700 text-white rounded-xl"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl"
                >
                  {isSubmitting
                    ? editingId
                      ? 'Atualizando...'
                      : 'Adicionando...'
                    : editingId
                      ? 'Atualizar'
                      : 'Adicionar'}
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

        <div className="space-y-4">
          {loading ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center text-gray-400">
              Carregando metas...
            </div>
          ) : goals.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
              <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma meta registrada</p>
            </div>
          ) : (
            goals.map((goal) => {
              const percentage = getProgressPercentage(goal)

              return (
                <div
                  key={goal.id}
                  className={`rounded-2xl border p-6 flex items-center justify-between hover:border-amber-600/30 transition gap-4 flex-wrap ${getStatusColor(goal)}`}
                >
                  <div className="flex-1 min-w-[260px]">
                    <h3 className="text-lg font-semibold text-white">{goal.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">Categoria: {goal.category}</p>

                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-300">Progresso</span>
                        <span className="text-sm font-semibold text-amber-600">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>

                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-amber-600 to-amber-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-gray-400 text-sm mt-3">
                      {formatCurrency(goal.current_amount, currency)} /{' '}
                      {formatCurrency(goal.target_amount, currency)}
                    </p>

                    <p className="text-gray-500 text-xs mt-2">
                      Data alvo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEdit(goal)}
                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleDelete(goal.id)}
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {goals.length > 0 && (
          <div className="mt-8 bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Progresso total das metas</p>
            <div className="flex justify-between items-center mb-3">
              <span className="text-white font-medium">
                {formatCurrency(totalCurrentAmount, currency)} de{' '}
                {formatCurrency(totalTargetAmount, currency)}
              </span>
              <span className="text-amber-600 font-semibold">{progressTotal.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-amber-600 to-amber-500 h-3 rounded-full"
                style={{ width: `${progressTotal}%` }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
