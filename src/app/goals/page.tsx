'use client'

import { useEffect, useMemo, useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Target, Trophy, Wallet } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { CompactFilterBar } from '@/components/CompactFilterBar'
import { AppStatCard } from '@/components/AppStatCard'

interface Goal {
  id: string
  title: string
  target_amount: number
  current_amount: number
  deadline: string
  category: string
  status: 'active' | 'completed' | 'cancelled'
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number(value) || 0)
}

function normalizeDate(value?: string | null) {
  if (!value) return ''
  return String(value).split('T')[0]
}

function getGoalProgress(goal: Goal) {
  const current = Number(goal.current_amount) || 0
  const target = Number(goal.target_amount) || 0
  if (target <= 0) return 0
  return Math.min((current / target) * 100, 100)
}

export default function GoalsPage() {
  const { userId, loading: authLoading } = useAuth()

  const [goals, setGoals] = useState<Goal[]>([])
  const [currency, setCurrency] = useState('BRL')
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Goal['status']>('all')
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    target_amount: '',
    current_amount: '',
    deadline: new Date().toISOString().split('T')[0],
    category: '',
  })

  useEffect(() => {
    if (authLoading) return
    if (!userId || !supabase) {
      setLoading(false)
      return
    }

    fetchCurrency()
    fetchGoals()
  }, [authLoading, userId])

  const fetchCurrency = async () => {
    const { data } = await supabase.from('users').select('currency').eq('id', userId).single()

    if (data?.currency) {
      setCurrency(data.currency)
    }
  }

  const fetchGoals = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('deadline', { ascending: true })

      if (error) {
        throw error
      }

      setGoals((data || []) as Goal[])
    } catch (error: any) {
      console.error('Erro ao buscar metas:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível carregar as metas',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const visibleGoals = useMemo(() => {
    let rows = [...goals]

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      rows = rows.filter((goal) => {
        return (
          (goal.title || '').toLowerCase().includes(term) ||
          (goal.category || '').toLowerCase().includes(term)
        )
      })
    }

    if (statusFilter !== 'all') {
      rows = rows.filter((goal) => goal.status === statusFilter)
    }

    if (month) {
      rows = rows.filter((goal) => normalizeDate(goal.deadline).startsWith(month))
    } else {
      if (startDate) {
        rows = rows.filter((goal) => normalizeDate(goal.deadline) >= startDate)
      }
      if (endDate) {
        rows = rows.filter((goal) => normalizeDate(goal.deadline) <= endDate)
      }
    }

    return rows
  }, [goals, search, statusFilter, month, startDate, endDate])

  const stats = useMemo(() => {
    const active = goals.filter((goal) => goal.status === 'active')
    const completed = goals.filter((goal) => goal.status === 'completed')
    const totalTarget = active.reduce((sum, goal) => sum + (Number(goal.target_amount) || 0), 0)
    const totalSaved = active.reduce((sum, goal) => sum + (Number(goal.current_amount) || 0), 0)

    return {
      total: goals.length,
      active: active.length,
      completed: completed.length,
      progress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
    }
  }, [goals])

  const resetForm = () => {
    setFormData({
      title: '',
      target_amount: '',
      current_amount: '',
      deadline: new Date().toISOString().split('T')[0],
      category: '',
    })
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !userId) return

    const targetAmount = Number(formData.target_amount)
    const currentAmount = Number(formData.current_amount || 0)

    if (!formData.title.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o título da meta',
        variant: 'destructive',
      })
      return
    }

    if (!targetAmount || targetAmount <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor alvo maior que zero',
        variant: 'destructive',
      })
      return
    }

    try {
      await supabase.from('goals').insert([
        {
          user_id: userId,
          title: formData.title.trim(),
          target_amount: targetAmount,
          current_amount: currentAmount,
          deadline: formData.deadline,
          category: formData.category.trim(),
          status: currentAmount >= targetAmount ? 'completed' : 'active',
        },
      ])

      toast({
        title: 'Sucesso',
        description: 'Meta criada com sucesso',
      })

      resetForm()
      fetchGoals()
    } catch (error: any) {
      console.error('Erro ao salvar meta:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar a meta',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return

    try {
      await supabase.from('goals').delete().eq('id', id)
      toast({
        title: 'Sucesso',
        description: 'Meta removida com sucesso',
      })
      fetchGoals()
    } catch (error: any) {
      console.error('Erro ao excluir meta:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível excluir a meta',
        variant: 'destructive',
      })
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <p className="text-white">Carregando metas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Metas</h1>
            <p className="text-[#94a3b8]">Acompanhe seus objetivos financeiros</p>
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
          <AppStatCard title="Total de Metas" value={stats.total} icon={Target} />
          <AppStatCard title="Ativas" value={stats.active} valueClassName="text-amber-500" icon={Wallet} />
          <AppStatCard title="Concluídas" value={stats.completed} valueClassName="text-green-500" icon={Trophy} />
          <AppStatCard
            title="Progresso Geral"
            value={`${stats.progress.toFixed(1)}%`}
            subtitle="Soma do valor atual / soma do valor alvo"
          />
        </div>

        <CompactFilterBar
          search={search}
          onSearchChange={setSearch}
          onToggleFilters={() => setShowFilters((prev) => !prev)}
          onClear={() => {
            setSearch('')
            setStatusFilter('all')
            setMonth('')
            setStartDate('')
            setEndDate('')
          }}
          showFilters={showFilters}
          placeholder="Buscar por título ou categoria"
          searchClassName="lg:max-w-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | Goal['status'])}
                className="w-full h-10 bg-[#1a263d] border border-[#2a3650] text-white rounded-xl px-3"
              >
                <option value="all">Todos</option>
                <option value="active">Ativa</option>
                <option value="completed">Concluída</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>

            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Mês limite</Label>
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
                className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Data inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
                className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
              />
            </div>

            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
                className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
              />
            </div>
          </div>
        </CompactFilterBar>

        {showForm && (
          <div className="bg-[#08152d] rounded-2xl border border-[#1f2a44] p-6 mb-8">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-2">
                <Label className="text-gray-300 text-sm mb-2 block">Título</Label>
                <Input
                  placeholder="Ex: Reserva de emergência"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                  required
                />
              </div>

              <div>
                <Label className="text-gray-300 text-sm mb-2 block">Valor alvo</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                  required
                />
              </div>

              <div>
                <Label className="text-gray-300 text-sm mb-2 block">Valor atual</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.current_amount}
                  onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                  className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                />
              </div>

              <div>
                <Label className="text-gray-300 text-sm mb-2 block">Categoria</Label>
                <Input
                  placeholder="Ex: Viagem"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                />
              </div>

              <div>
                <Label className="text-gray-300 text-sm mb-2 block">Prazo</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                  required
                />
              </div>

              <div className="md:col-span-2 xl:col-span-5 flex gap-3 flex-wrap pt-2">
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                  Salvar Meta
                </Button>
                <Button
                  type="button"
                  onClick={resetForm}
                  className="border border-[#2a3650] bg-black text-white hover:bg-[#111827] rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {visibleGoals.length === 0 ? (
            <div className="lg:col-span-2 bg-[#08152d] rounded-2xl border border-[#1f2a44] p-12 text-center">
              <Target className="w-12 h-12 text-[#64748b] mx-auto mb-4" />
              <p className="text-[#94a3b8]">Nenhuma meta encontrada</p>
            </div>
          ) : (
            visibleGoals.map((goal) => {
              const progress = getGoalProgress(goal)
              const remaining =
                Math.max((Number(goal.target_amount) || 0) - (Number(goal.current_amount) || 0), 0)

              return (
                <div
                  key={goal.id}
                  className="bg-[#08152d] rounded-2xl border border-[#1f2a44] p-6 hover:border-[#2a3650] transition"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{goal.title}</h3>
                      <p className="text-sm text-[#94a3b8] mt-1">
                        {goal.category || 'Sem categoria'} • Prazo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="text-red-400 hover:text-red-300 transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[#94a3b8]">Progresso</span>
                      <span className="text-white font-medium">{progress.toFixed(1)}%</span>
                    </div>

                    <div className="w-full h-3 bg-[#111827] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          goal.status === 'completed'
                            ? 'bg-green-500'
                            : goal.status === 'cancelled'
                              ? 'bg-gray-500'
                              : 'bg-amber-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="rounded-xl bg-[#030b1d] border border-[#1f2a44] p-4">
                      <p className="text-sm text-[#94a3b8] mb-1">Atual</p>
                      <p className="text-white font-semibold">
                        {formatCurrency(goal.current_amount, currency)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#030b1d] border border-[#1f2a44] p-4">
                      <p className="text-sm text-[#94a3b8] mb-1">Alvo</p>
                      <p className="text-white font-semibold">
                        {formatCurrency(goal.target_amount, currency)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        goal.status === 'completed'
                          ? 'bg-green-500/10 text-green-400'
                          : goal.status === 'cancelled'
                            ? 'bg-gray-500/10 text-gray-300'
                            : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {goal.status === 'completed'
                        ? 'Concluída'
                        : goal.status === 'cancelled'
                          ? 'Cancelada'
                          : 'Ativa'}
                    </span>

                    <p className="text-sm text-[#94a3b8]">
                      Falta: <span className="text-white font-medium">{formatCurrency(remaining, currency)}</span>
                    </p>
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
