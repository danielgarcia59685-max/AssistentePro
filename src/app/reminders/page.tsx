'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useAuth from '@/hooks/useAuth'
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
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Edit,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface Reminder {
  id: string
  title: string
  description: string
  due_date: string
  status: 'pending' | 'completed'
  reminder_type: string
  due_time?: string | null
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

export default function RemindersPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: getLocalDateString(),
    due_time: '',
    reminder_type: 'task',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    if (!authLoading && !userId) {
      router.push('/login')
      return
    }

    if (userId) {
      fetchReminders()
    }
  }, [userId, authLoading, router, dateRange.start, dateRange.end, statusFilter])

  const fetchReminders = async () => {
    if (!supabase || !userId) return

    try {
      let query = supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })

      if (dateRange.start) query = query.gte('due_date', dateRange.start)
      if (dateRange.end) query = query.lte('due_date', dateRange.end)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)

      const { data, error } = await query

      if (!error && data) {
        setReminders(
          (data as Reminder[]).map((reminder) => ({
            ...reminder,
            due_date: normalizeDateOnly(reminder.due_date),
          })),
        )
      }
    } catch (error) {
      console.error('Erro ao buscar lembretes:', error)
    }
  }

  const visibleReminders = useMemo(() => {
    let rows = [...reminders]

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      rows = rows.filter(
        (reminder) =>
          reminder.title.toLowerCase().includes(term) ||
          (reminder.description || '').toLowerCase().includes(term),
      )
    }

    return rows
  }, [reminders, search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente para salvar o compromisso',
        variant: 'destructive',
      })
      return
    }

    const authUserId = sessionData.session.user.id
    const authEmail = sessionData.session.user.email || ''
    const fallbackName = authEmail ? authEmail.split('@')[0] : 'Usuário'

    if (!formData.title || formData.title.trim().length === 0) {
      toast({
        title: 'Título inválido',
        description: 'Informe um título para o lembrete',
        variant: 'destructive',
      })
      return
    }

    if (!formData.due_date) {
      toast({
        title: 'Data inválida',
        description: 'Informe uma data para o lembrete',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        due_date: normalizeDateOnly(formData.due_date),
        due_time: formData.due_time || null,
        reminder_type: formData.reminder_type,
      }

      if (editingId) {
        const { error } = await supabase.from('reminders').update(payload).eq('id', editingId)

        if (error) {
          toast({
            title: 'Erro',
            description: (error as any)?.message || 'Falha ao atualizar compromisso',
            variant: 'destructive',
          })
          return
        }
      } else {
        await supabase
          .from('users')
          .upsert([
            { id: authUserId, email: authEmail || `${authUserId}@local`, name: fallbackName },
          ])
          .throwOnError()

        const { error } = await supabase.from('reminders').insert([
          {
            ...payload,
            user_id: authUserId,
            status: 'pending',
          },
        ])

        if (error) {
          toast({
            title: 'Erro',
            description: (error as any)?.message || 'Falha ao criar compromisso',
            variant: 'destructive',
          })
          return
        }
      }

      resetForm()
      fetchReminders()
      toast({ title: 'Sucesso', description: 'Compromisso salvo com sucesso' })
    } catch (error) {
      console.error('Erro ao salvar lembrete:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o compromisso',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: getLocalDateString(),
      due_time: '',
      reminder_type: 'task',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm('Tem certeza?')) return

    try {
      await supabase.from('reminders').delete().eq('id', id)
      fetchReminders()
    } catch (error) {
      console.error('Erro ao deletar:', error)
    }
  }

  const handleMarkAsCompleted = async (id: string) => {
    if (!supabase) return

    try {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', id)
      fetchReminders()
    } catch (error) {
      console.error('Erro ao atualizar:', error)
    }
  }

  const handleEdit = (reminder: Reminder) => {
    setFormData({
      title: reminder.title,
      description: reminder.description,
      due_date: normalizeDateOnly(reminder.due_date),
      due_time: reminder.due_time || '',
      reminder_type: reminder.reminder_type,
    })
    setEditingId(reminder.id)
    setShowForm(true)
  }

  const pendingReminders = visibleReminders.filter((r) => r.status === 'pending')
  const completedReminders = visibleReminders.filter((r) => r.status === 'completed')
  const today = getLocalDateString()
  const upcomingCount = reminders.filter(
    (r) => r.status === 'pending' && normalizeDateOnly(r.due_date) >= today,
  ).length

  const hasActiveFilters = !!month || !!startDate || !!endDate || statusFilter !== 'all'

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Compromissos</h1>
            <p className="text-gray-400">Mantenha-se atualizado com seus compromissos</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Novo Compromisso
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Total</p>
            <p className="text-3xl font-bold text-white">{reminders.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Pendentes</p>
            <p className="text-3xl font-bold text-red-500">
              {reminders.filter((r) => r.status === 'pending').length}
            </p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Concluídos</p>
            <p className="text-3xl font-bold text-green-500">
              {reminders.filter((r) => r.status === 'completed').length}
            </p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Próximos</p>
            <p className="text-3xl font-bold text-blue-500">{upcomingCount}</p>
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
                className="bg-gray-800 border-gray-700 text-white rounded-xl pl-10"
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
                setMonth('')
                setStartDate('')
                setEndDate('')
                setStatusFilter('all')
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
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
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
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
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
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 text-sm mb-2 block">Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value: 'all' | 'pending' | 'completed') => setStatusFilter(value)}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {showForm && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300">Título</Label>
                  <Input
                    placeholder="Título do compromisso"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Data</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Hora</Label>
                  <Input
                    type="time"
                    value={formData.due_time}
                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Tipo</Label>
                  <Input
                    placeholder="Ex: task"
                    value={formData.reminder_type}
                    onChange={(e) => setFormData({ ...formData, reminder_type: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Descrição</Label>
                <Input
                  placeholder="Descrição do compromisso"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

        <div className="space-y-8">
          {pendingReminders.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-amber-600" />
                Pendentes
              </h2>
              <div className="space-y-3">
                {pendingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex items-center justify-between hover:border-gray-700 transition"
                  >
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{reminder.title}</h3>
                      <p className="text-gray-400 text-sm mt-1">{reminder.description}</p>
                      <p className="text-gray-500 text-sm mt-2">
                        Vencimento: {formatDateBR(reminder.due_date)}
                        {reminder.due_time ? ` às ${reminder.due_time}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEdit(reminder)}
                        className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsCompleted(reminder.id)}
                        className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDelete(reminder.id)}
                        className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedReminders.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-500 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                Concluídos
              </h2>
              <div className="space-y-3">
                {completedReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 flex items-center justify-between opacity-75"
                  >
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-400 line-through">
                        {reminder.title}
                      </h3>
                      <p className="text-gray-500 text-sm mt-2">
                        Concluído em: {formatDateBR(reminder.due_date)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleDelete(reminder.id)}
                      className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleReminders.length === 0 && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
              <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhum compromisso registrado</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
