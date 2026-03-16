'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCircle2,
  Clock,
  Edit,
  Plus,
  Trash2,
  CalendarClock,
  ListTodo,
} from 'lucide-react'
import useAuth from '@/hooks/useAuth'
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

function formatDateBR(dateString: string) {
  if (!dateString) return '-'

  const onlyDate = dateString.split('T')[0]
  const [year, month, day] = onlyDate.split('-')

  if (!year || !month || !day) return dateString

  return `${day}/${month}/${year}`
}

export default function RemindersPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
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
        setReminders(data as Reminder[])
      }
    } catch (error) {
      console.error('Erro ao buscar lembretes:', error)
    }
  }

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
      if (editingId) {
        const { error } = await supabase
          .from('reminders')
          .update({
            title: formData.title,
            description: formData.description,
            due_date: formData.due_date,
            due_time: formData.due_time || null,
            reminder_type: formData.reminder_type,
          })
          .eq('id', editingId)

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
            ...formData,
            due_time: formData.due_time || null,
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
    } catch {
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
      toast({ title: 'Sucesso', description: 'Compromisso removido com sucesso' })
    } catch {
      toast({ title: 'Erro', description: 'Erro ao deletar compromisso', variant: 'destructive' })
    }
  }

  const handleMarkAsCompleted = async (id: string) => {
    if (!supabase) return

    try {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', id)
      fetchReminders()
      toast({ title: 'Sucesso', description: 'Compromisso concluído' })
    } catch {
      toast({ title: 'Erro', description: 'Erro ao atualizar compromisso', variant: 'destructive' })
    }
  }

  const handleEdit = (reminder: Reminder) => {
    setFormData({
      title: reminder.title,
      description: reminder.description,
      due_date: reminder.due_date.split('T')[0],
      due_time: reminder.due_time || '',
      reminder_type: reminder.reminder_type,
    })
    setEditingId(reminder.id)
    setShowForm(true)
  }

  const pendingReminders = reminders.filter((r) => r.status === 'pending')
  const completedReminders = reminders.filter((r) => r.status === 'completed')
  const today = getLocalDateString()
  const upcomingCount = pendingReminders.filter((r) => r.due_date.split('T')[0] >= today).length

  return (
    <div className="min-h-screen bg-app">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="premium-chip mb-4">Agenda inteligente</div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Compromissos</h1>
            <p className="mt-2 text-slate-400">Organize lembretes, tarefas e datas importantes</p>
          </div>

          <Button
            onClick={() => setShowForm(!showForm)}
            className="rounded-2xl border-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 px-6 py-3 text-white hover:opacity-95"
          >
            <Plus className="mr-2 h-5 w-5" />
            Novo Compromisso
          </Button>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AppStatCard
            title="Total"
            value={reminders.length}
            subtitle="Todos os compromissos"
            icon={ListTodo}
          />
          <AppStatCard
            title="Pendentes"
            value={pendingReminders.length}
            subtitle="Aguardando conclusão"
            icon={Clock}
            valueClassName="text-amber-400"
          />
          <AppStatCard
            title="Concluídos"
            value={completedReminders.length}
            subtitle="Itens finalizados"
            icon={CheckCircle2}
            valueClassName="text-emerald-400"
          />
          <AppStatCard
            title="Próximos"
            value={upcomingCount}
            subtitle="Ainda por acontecer"
            icon={CalendarClock}
            valueClassName="text-blue-400"
          />
        </section>

        <section className="premium-panel mb-8 p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-white">Filtros</h2>
            <p className="mt-1 text-sm text-slate-400">Filtre seus compromissos por data e status</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Mês</Label>
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
                className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Data inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
                className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
                className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'pending' | 'completed') => setStatusFilter(value)}
              >
                <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-white">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMonth('')
                setStartDate('')
                setEndDate('')
                setStatusFilter('all')
              }}
              className="rounded-2xl border-white/10 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
            >
              Limpar filtros
            </Button>
          </div>
        </section>

        {showForm ? (
          <section className="premium-panel mb-8 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Editar compromisso' : 'Novo compromisso'}
              </h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">Título</Label>
                  <Input
                    placeholder="Título do lembrete"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Data</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Hora</Label>
                  <Input
                    type="time"
                    value={formData.due_time}
                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Tipo</Label>
                  <Select
                    value={formData.reminder_type}
                    onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="task">Tarefa</SelectItem>
                      <SelectItem value="meeting">Reunião</SelectItem>
                      <SelectItem value="payment">Pagamento</SelectItem>
                      <SelectItem value="personal">Pessoal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Descrição</Label>
                <Input
                  placeholder="Descrição do compromisso"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-2xl border-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 px-6 py-3 text-white hover:opacity-95"
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
                  className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-3 text-slate-200 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="space-y-8">
          {pendingReminders.length > 0 ? (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-white">
                <Clock className="h-6 w-6 text-amber-400" />
                Pendentes
              </h2>

              <div className="space-y-3">
                {pendingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="premium-panel flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{reminder.title}</h3>
                      <p className="mt-1 text-sm text-slate-400">{reminder.description}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        Vencimento: {formatDateBR(reminder.due_date)}
                        {reminder.due_time ? ` às ${reminder.due_time}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEdit(reminder)}
                        className="h-10 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 text-blue-300 hover:bg-blue-500/15"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsCompleted(reminder.id)}
                        className="h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-emerald-300 hover:bg-emerald-500/15"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDelete(reminder.id)}
                        className="h-10 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-red-300 hover:bg-red-500/15"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {completedReminders.length > 0 ? (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-400">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                Concluídos
              </h2>

              <div className="space-y-3">
                {completedReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="premium-panel-soft flex flex-col gap-4 p-6 opacity-75 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-400 line-through">
                        {reminder.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        Concluído em: {formatDateBR(reminder.due_date)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleDelete(reminder.id)}
                      className="h-10 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-red-300 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {reminders.length === 0 ? (
            <div className="premium-panel p-12 text-center">
              <Bell className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-slate-400">Nenhum compromisso registrado</p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
