'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { Target, Plus, Trash2, TrendingUp, Edit } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  category: string
  deadline: string
}

export default function GoalsPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currency, setCurrency] = useState('BRL')
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    category: 'savings',
    deadline: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
      return
    }
    if (userId) {
      fetchProfileCurrency()
      fetchGoals()
    }
  }, [userId, authLoading, router])

  const fetchProfileCurrency = async () => {
    if (!supabase || !userId) return
    const { data } = await supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .single()
    if (data?.currency) setCurrency(data.currency)
  }

  const fetchGoals = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('financial_goals')
        .select('*')
        .eq('user_id', userId)
        .order('deadline', { ascending: true })

      if (!error && data) {
        setGoals(data)
      }
    } catch (error) {
      console.error('Erro ao buscar metas:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (!userId) {
      toast({ title: 'Sessão expirada', description: 'Faça login novamente para salvar a meta', variant: 'destructive' })
      return
    }

    // Validação
    if (!formData.name || formData.name.trim().length === 0) {
      toast({ title: 'Nome inválido', description: 'Informe um nome para a meta', variant: 'destructive' })
      return
    }
    if (!formData.target_amount || isNaN(Number(formData.target_amount)) || Number(formData.target_amount) <= 0) {
      toast({ title: 'Valor alvo inválido', description: 'Informe um valor alvo maior que 0', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      if (editingId) {
        await supabase.from('financial_goals').update({
          name: formData.name,
          target_amount: parseFloat(formData.target_amount),
          current_amount: parseFloat(formData.current_amount) || 0,
          category: formData.category,
          deadline: formData.deadline,
        }).eq('id', editingId).throwOnError()
      } else {
        await supabase.from('financial_goals').insert([{
          user_id: userId,
          name: formData.name,
          target_amount: parseFloat(formData.target_amount),
          current_amount: parseFloat(formData.current_amount) || 0,
          category: formData.category,
          deadline: formData.deadline,
        }]).throwOnError()
      }

      resetForm()
      fetchGoals()
      toast({ title: 'Sucesso', description: 'Meta salva com sucesso' })
    } catch (error) {
      console.error('Erro ao salvar meta:', error)
      toast({ title: 'Erro', description: 'Não foi possível salvar a meta', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', target_amount: '', current_amount: '', category: 'savings', deadline: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0] })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (goal: Goal) => {
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      category: goal.category,
      deadline: goal.deadline.split('T')[0],
    })
    setEditingId(goal.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm('Tem certeza?')) return

    try {
      await supabase.from('financial_goals').delete().eq('id', id)
      fetchGoals()
    } catch (error) {
      console.error('Erro ao deletar:', error)
    }
  }

  const totalGoals = goals.length
  const completedGoals = goals.filter(g => g.current_amount >= g.target_amount).length
  const inProgressGoals = goals.filter(g => g.current_amount > 0 && g.current_amount < g.target_amount).length
  const totalTargetAmount = goals.reduce((sum, g) => sum + g.target_amount, 0)
  const totalCurrentAmount = goals.reduce((sum, g) => sum + g.current_amount, 0)

  const getProgressPercentage = (goal: Goal) => {
    return goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
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
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Metas Financeiras</h1>
            <p className="text-gray-400">Acompanhe suas metas e objetivos</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nova Meta
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Total de Metas</p>
            <p className="text-3xl font-bold text-white">{totalGoals}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Valor Total</p>
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(totalTargetAmount, currency)}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Acumulado</p>
            <p className="text-3xl font-bold text-green-500">{formatCurrency(totalCurrentAmount, currency)}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Concluídas</p>
            <p className="text-3xl font-bold text-blue-500">{completedGoals}</p>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300">Nome da Meta</Label>
                  <Input placeholder="Ex: Comprar carro" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Categoria</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
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
                  <Input type="number" placeholder="0.00" value={formData.target_amount} onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })} required className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Valor Atual</Label>
                  <Input type="number" placeholder="0.00" value={formData.current_amount} onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                  <Label className="text-gray-300">Data Alvo</Label>
                  <Input type="date" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} required className="bg-gray-800 border-gray-700 text-white rounded-xl" />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl">{isSubmitting ? (editingId ? 'Atualizando...' : 'Adicionando...') : (editingId ? 'Atualizar' : 'Adicionar')}</Button>
                <Button type="button" onClick={() => resetForm()} className="border border-gray-700 text-gray-300 hover:bg-gray-800 px-6 py-3 rounded-xl">Cancelar</Button>
              </div>
            </form>
          </div>
        )}

        {/* Goals List */}
        <div className="space-y-4">
          {goals.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
              <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma meta registrada</p>
            </div>
          ) : (
            goals.map(goal => {
              const percentage = getProgressPercentage(goal)
              return (
                <div key={goal.id} className={`rounded-2xl border p-6 flex items-center justify-between hover:border-amber-600/30 transition ${getStatusColor(goal)}`}>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{goal.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">Categoria: {goal.category}</p>
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-300">Progresso</span>
                        <span className="text-sm font-semibold text-amber-600">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-amber-600 to-amber-500 h-2 rounded-full"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm mt-3">{formatCurrency(goal.current_amount, currency)} / {formatCurrency(goal.target_amount, currency)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleEdit(goal)} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30 rounded-lg">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleDelete(goal.id)} className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
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
