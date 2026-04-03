'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/hooks/useAuth'
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
import {
  Target,
  Plus,
  Edit,
  Trash2,
  Search,
  SlidersHorizontal,
  X,
  Trophy,
  TrendingUp,
} from 'lucide-react'
import { toast } from '@/hooks/useToast'

type GoalStatus = 'active' | 'completed' | 'paused'

interface Goal {
  id: string
  title: string
  description?: string | null
  target_amount: number
  current_amount: number
  deadline?: string | null
  status: GoalStatus
  created_at?: string | null
}

function getLocalDateString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const localDate = new Date(now.getTime() - offset * 60 * 1000)
  return localDate.toISOString().split('T')[0]
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

function formatCurrency(value: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(Number(value) || 0)
}

function getMonthRange(month: string) {
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

export default function GoalsPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()

  const [goals, setGoals] = useState<Goal[]>([])
  const [currency, setCurrency] = useState('BRL')

  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | GoalStatus>('all')
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    target_amount: '',
    current_amount: '',
    deadline: getLocalDateString(),
    status: 'active' as GoalStatus,
  })

  const dateRange = useMemo(() => {
    if (month) return getMonthRange(month)

    return {
      start: startDate || null,
      end: endDate || null,
    }
  }, [month, startDate, endDate])

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
      return
    }

    if (userId) {
      fetchCurrency()
      fetchGoals()
    }
  }, [authLoading, userId, router, statusFilter, dateRange.start, dateRange.end])

  const fetchCurrency = async () => {
    if (!supabase || !userId) return
    const { data } = await supabase.from('users').select('currency').eq('id', userId).single()
    if (data?.currency) setCurrency(data.currency)
  }

  const fetchGoals = async () => {
    if (!supabase || !userId) return

    try {
      let query = supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (dateRange.start) {
        query = query.gte('deadline', dateRange.start)
      }

      if (dateRange.end) {
        query = query.lte('deadline', dateRange.end)
      }

      const { data, error } = await query

      if (error) {
        toast({
          title: 'Erro',
          description: error.message || 'Falha ao buscar metas',
          variant: 'destructive',
        })
        return
      }

      setGoals(
        ((data || []) as Goal[]).map((goal) => ({
          ...goal,
          deadline: normalizeDateOnly(goal.deadline),
        })),
      )
    } catch (error) {
      console.error(error)
      toast({
        title: 'Erro',
        description: 'Falha ao buscar metas',
        variant: 'destructive',
      })
    }
  }

  const visibleGoals = useMemo(() => {
    let rows = [...goals]

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      rows = rows.filter(
        (goal) =>
          goal.title.toLowerCase().includes(term) ||
          (goal.description || '').toLowerCase().includes(term),
      )
    }

    return rows
  }, [goals, search])

  const totals = useMemo(() => {
    const active = goals.filter((g) => g.status === 'active').length
    const completed = goals.filter((g) => g.status === 'completed').length
    const paused = goals.filter((g) => g.status === 'paused').length

    const targetTotal = goals.reduce((sum, g) => sum + Number(g.target_amount || 0), 0)
    const currentTotal = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0)

    return {
      active,
      completed,
      paused,
      targetTotal,
      currentTotal,
    }
  }, [goals])

  const hasActiveFilters =
    !!search || statusFilter !== 'all' || !!month || !!startDate || !!endDate

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      target_amount: '',
      current_amount: '',
      deadline: getLocalDateString(),
      status: 'active',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !userId) {
      toast({
        title: 'Erro',
        description: 'Sessão inválida',
        variant: 'destructive',
      })
      return
    }

    if (!formData.title.trim()) {
      toast({
        title: 'Erro',
        description: 'Informe o título da meta',
        variant: 'destructive',
      })
      return
    }

    if (!formData.target_amount || Number(formData.target_amount) <= 0) {
      toast({
        title: 'Erro',
        description: 'Informe um valor alvo maior que zero',
        variant: 'destructive',
      })
      return
    }

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        target_amount: Number(formData.target_amount),
        current_amount: Number(formData.current_amount || 0),
        deadline: normalizeDateOnly(formData.deadline),
        status: formData.status,
      }

      if (editingId) {
        const { error } = await supabase.from('goals').update(payload).eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('goals').insert([
          {
            user_id: userId,
            ...payload,
          },
        ])

        if (error) throw error
      }

      resetForm()
      fetchGoals()

      toast({
        title: 'Sucesso',
        description: 'Meta salva com sucesso',
      })
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao salvar meta',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (goal: Goal) => {
    setFormData({
      title: goal.title || '',
      description: goal.description || '',
      target_amount: String(goal.target_amount || ''),
      current_amount: String(goal.current_amount || ''),
      deadline: normalizeDateOnly(goal.deadline) || getLocalDateString(),
      status: goal.status || 'active',
    })
    setEditingId(goal.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return

    try {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
      fetchGoals()
      toast({ title: 'Sucesso', description: 'Meta excluída com sucesso' })
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao excluir meta',
        variant: 'destructive',
      })
    }
  }

  const getProgress = (goal: Goal) => {
    const target = Number(goal.target_amount || 0)
    const current = Number(goal.current_amount || 0)
    if (target <= 0) return 0
    return Math.min((current / target) * 100, 100)
  }

  const getStatusLabel = (status: GoalStatus) => {
    switch (status) {
      case 'active':
        return 'Ativa'
      case 'completed':
        return 'Concluída'
      case 'paused':
        return 'Pausada'
      default:
        return status
    }
  }

  const getStatusClasses = (status: GoalStatus) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500/10 text-blue-400'
      case 'completed':
        return 'bg-green-500/10 text-green-400'
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-400'
      default:
        return 'bg-gray-500/10 text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Metas</h1>
            <p className="text-gray-400">Acompanhe seus objetivos financeiros</p>
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
            <p className="text-gray-400 text-sm mb-2">Metas ativas</p>
            <p className="text-3xl font-bold text-blue-500">{totals.active}</p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Concluídas</p>
            <p className="text-3xl font-bold text-green-500">{totals.completed}</p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Total planejado</p>
            <p className="text-3xl font-bold text-amber-500">
              {formatCurrency(totals.targetTotal, currency)}
            </p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Total acumulado</p>
            <p className="text-3xl font-bold text-green-400">
              {formatCurrency(totals.currentTotal, currency)}
            </p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Pesquisar por título ou descrição"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-gray-800 border-gray-700 rounded-xl pl-10 text-white"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters((prev) => !prev)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filtros
              {hasActiveFilters ? (
                <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-amber-500" />
              ) : null}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setMonth('')
                setStartDate('')
                setEndDate('')
              }}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 border-t border-gray-800 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-gray-300 text-sm mb-2 block">Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value: 'all' | GoalStatus) => setStatusFilter(value)}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 rounded-xl text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-300 text-sm mb-2 block">Mês</Label>
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
                    className="bg-gray-800 border-gray-700 rounded-xl text-white"
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
                    className="bg-gray-800 border-gray-700 rounded-xl text-white"
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
                    className="bg-gray-800 border-gray-700 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {showForm && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingId ? 'Editar' : 'Adicionar'} Meta
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Título</Label>
                  <Input
                    placeholder="Ex: Reserva de emergência"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 rounded-xl text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Prazo</Label>
                  <Input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="bg-gray-800 border-gray-700 rounded-xl text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Valor alvo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.target_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, target_amount: e.target.value })
                    }
                    required
                    className="bg-gray-800 border-gray-700 rounded-xl text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Valor atual</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.current_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, current_amount: e.target.value })
                    }
                    className="bg-gray-800 border-gray-700 rounded-xl text-white"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-gray-300 font-semibold">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: GoalStatus) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 rounded-xl text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="paused">Pausada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 font-semibold">Descrição</Label>
                <Input
                  placeholder="Descrição da meta"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-gray-800 border-gray-700 rounded-xl text-white"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl"
                >
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

        <div className="space-y-4">
          {visibleGoals.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
              <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma meta registrada</p>
            </div>
          ) : (
            visibleGoals.map((goal) => {
              const progress = getProgress(goal)

              return (
                <div
                  key={goal.id}
                  className="bg-gray-900 rounded-2xl border border-gray-800 p-6 hover:border-gray-700 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        <h3 className="text-xl font-semibold text-white">{goal.title}</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClasses(goal.status)}`}
                        >
                          {getStatusLabel(goal.status)}
                        </span>
                      </div>

                      {goal.description ? (
                        <p className="text-gray-400 mb-4">{goal.description}</p>
                      ) : null}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-800">
                          <p className="text-gray-400 text-sm mb-1">Atual</p>
                          <p className="text-lg font-bold text-green-400">
                            {formatCurrency(goal.current_amount, currency)}
                          </p>
                        </div>

                        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-800">
                          <p className="text-gray-400 text-sm mb-1">Meta</p>
                          <p className="text-lg font-bold text-amber-400">
                            {formatCurrency(goal.target_amount, currency)}
                          </p>
                        </div>

                        <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-800">
                          <p className="text-gray-400 text-sm mb-1">Prazo</p>
                          <p className="text-lg font-bold text-blue-400">
                            {formatDateBR(goal.deadline)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Progresso</span>
                          <span className="text-sm font-semibold text-white">
                            {progress.toFixed(1)}%
                          </span>
                        </div>

                        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress >= 100
                                ? 'bg-green-500'
                                : progress >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row lg:flex-col gap-2">
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
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
