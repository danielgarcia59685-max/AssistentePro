'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Plus, Target, Trash2, Trophy } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Navigation } from '@/components/Navigation'
import { AppStatCard } from '@/components/AppStatCard'
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
import { toast } from '@/hooks/useToast'

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number(value) || 0)
}

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
    const { data } = await supabase.from('users').select('currency').eq('id', userId).single()
    if (data?.currency) setCurrency(data.currency)
  }

  const fetchGoals = async () => {
    if (!supabase || !userId) return

    try {
      const { data, error } = await supabase
        .from('financial_goals')
        .select('*')
        .eq('user_id', userId)
        .order('deadline', { ascending: true })

      if (!error && data) setGoals(data)
    } catch {}
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

    if (!formData.name || formData.name.trim().length === 0) {
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

    setIsSubmitting(true)
    try {
      if (editingId) {
        await supabase
          .from('financial_goals')
          .update({
            name: formData.name,
            target_amount: parseFloat(formData.target_amount),
            current_amount: parseFloat(formData.current_amount) || 0,
            category: formData.category,
            deadline: formData.deadline,
          })
          .eq('id', editingId)
          .throwOnError()
      } else {
        await supabase
          .from('financial_goals')
          .insert([
            {
              user_id: sessionUserId,
              name: formData.name,
              target_amount: parseFloat(formData.target_amount),
              current_amount: parseFloat(formData.current_amount) || 0,
              category: formData.category,
              deadline: formData.deadline,
            },
          ])
          .throwOnError()
      }

      resetForm()
      fetchGoals()
      toast({ title: 'Sucesso', description: 'Meta salva com sucesso' })
    } catch (error: any) {
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
    } catch {}
  }

  const totalGoals = goals.length
  const completedGoals = goals.filter((g) => g.current_amount >= g.target_amount).length
  const totalTargetAmount = goals.reduce((sum, g) => sum + g.target_amount, 0)
  const totalCurrentAmount = goals.reduce((sum, g) => sum + g.current_amount, 0)

  const getProgressPercentage = (goal: Goal) =>
    goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0

  return (
    <div className="bg-app min-h-screen">
      <Navigation />

      <main className="app-shell">
        <section className="page-header">
          <div>
            <div className="premium-chip mb-4">Planejamento de objetivos</div>
            <h1 className="page-title">Metas financeiras</h1>
            <p className="page-subtitle">
              Defina objetivos, acompanhe seu progresso e visualize o quanto falta para chegar lá.
            </p>
          </div>

          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            Nova meta
          </Button>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <AppStatCard
            title="Total de metas"
            value={totalGoals}
            subtitle="Objetivos cadastrados"
            icon={Target}
            valueClassName="text-white"
          />
          <AppStatCard
            title="Valor total"
            value={formatCurrency(totalTargetAmount, currency)}
            subtitle="Somatório das metas"
            valueClassName="metric-warning"
          />
          <AppStatCard
            title="Acumulado"
            value={formatCurrency(totalCurrentAmount, currency)}
            subtitle="Valor já conquistado"
            valueClassName="metric-positive"
          />
          <AppStatCard
            title="Concluídas"
            value={completedGoals}
            subtitle="Metas batidas"
            icon={Trophy}
            valueClassName="metric-primary"
          />
        </section>

        {showForm ? (
          <section className="premium-panel mb-8 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Editar meta' : 'Nova meta'}
              </h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">Nome da meta</Label>
                  <Input
                    placeholder="Ex: Comprar carro"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Label className="text-slate-300">Valor alvo</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={formData.target_amount}
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Valor atual</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={formData.current_amount}
                    onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Prazo</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  required
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? editingId
                      ? 'Atualizando...'
                      : 'Salvando...'
                    : editingId
                      ? 'Atualizar meta'
                      : 'Salvar meta'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="space-y-4">
          {goals.length === 0 ? (
            <div className="premium-panel p-12 text-center">
              <Target className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-slate-400">Nenhuma meta registrada</p>
            </div>
          ) : (
            goals.map((goal) => {
              const percentage = getProgressPercentage(goal)

              return (
                <div key={goal.id} className="premium-panel p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold text-white">{goal.name}</h3>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            percentage >= 100
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : percentage > 0
                                ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                                : 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
                          }`}
                        >
                          {percentage >= 100 ? 'Concluída' : 'Em andamento'}
                        </span>
                      </div>

                      <p className="text-sm text-slate-400">Categoria: {goal.category}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Prazo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                      </p>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm text-slate-300">Progresso</span>
                          <span className="text-sm font-semibold text-blue-300">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>

                        <div className="h-3 w-full rounded-full bg-slate-900/90">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap justify-between gap-3 text-sm">
                          <span className="text-slate-400">
                            Atual: <strong className="text-white">{formatCurrency(goal.current_amount, currency)}</strong>
                          </span>
                          <span className="text-slate-400">
                            Alvo: <strong className="text-white">{formatCurrency(goal.target_amount, currency)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" onClick={() => handleEdit(goal)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => handleDelete(goal.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </section>
      </main>
    </div>
  )
}
