'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { Bell, Plus, Trash2, CheckCircle2, Clock, Edit } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'

interface Reminder {
  id: string
  title: string
  description: string | null
  due_date: string
  due_time?: string | null
  status: 'pending' | 'completed'
  reminder_type: string
}

export default function RemindersPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '',
    reminder_type: 'task',
  })

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

  const fetchReminders = useCallback(async () => {
    if (!supabase || !userId) return

    setLoading(true)

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

      if (error) throw error

      setReminders((data || []) as Reminder[])
    } catch (error: any) {
      console.error('Erro ao buscar lembretes:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível carregar os lembretes',
        variant: 'destructive',
      })
      setReminders([])
    } finally {
      setLoading(false)
    }
  }, [dateRange.end, dateRange.start, statusFilter, userId])

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
    }
  }, [authLoading, userId, router])

  useEffect(() => {
    if (!authLoading && userId) {
      fetchReminders()
    }
  }, [authLoading, userId, fetchReminders])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session

    if (!session) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente para salvar o compromisso',
        variant: 'destructive',
      })
      return
    }

    const authUserId = session.user.id
    const authEmail = session.user.email || ''
    const fallbackName = authEmail ? authEmail.split('@')[0] : 'Usuário'

    if (!formData.title.trim()) {
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
      await supabase
        .from('users')
        .upsert([
          {
            id: authUserId,
            email: authEmail || `${authUserId}@local`,
            name: fallbackName,
          },
        ])
        .throwOnError()

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        due_date: formData.due_date,
        due_time: formData.due_time || null,
        reminder_type: formData.reminder_type,
      }

      if (editingId) {
        await supabase.from('reminders').update(payload).eq('id', editingId).throwOnError()
      } else {
        await supabase
          .from('reminders')
          .insert([
            {
              ...payload,
              user_id: authUserId,
              status: 'pending',
            },
          ])
          .throwOnError()
      }

      resetForm()
      await fetchReminders()

      toast({
        title: 'Sucesso',
        description: editingId
          ? 'Compromisso atualizado com sucesso'
          : 'Compromisso criado com sucesso',
      })
    } catch (error: any) {
      console.error('Erro ao salvar lembrete:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível salvar o compromisso',
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
      due_date: new Date().toISOString().split('T')[0],
      due_time: '',
      reminder_type: 'task',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleDelete = async (id: string) => {
    if (!supabase || !window.confirm('Tem certeza que deseja excluir este lembrete?')) return

    try {
      await supabase.from('reminders').delete().eq('id', id).throwOnError()
      await fetchReminders()
      toast({ title: 'Sucesso', description: 'Lembrete excluído com sucesso' })
    } catch (error: any) {
      console.error('Erro ao deletar:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível excluir o lembrete',
        variant: 'destructive',
      })
    }
  }

  const handleMarkAsCompleted = async (id: string) => {
    if (!supabase) return

    try {
      await supabase
        .from('reminders')
        .update({ status: 'completed' })
        .eq('id', id)
        .throwOnError()

      await fetchReminders()
      toast({ title: 'Sucesso', description: 'Lembrete concluído com sucesso' })
    } catch (error: any) {
      console.error('Erro ao atualizar:', error)
      toast({
        title: 'Erro',
        description: error?.message || 'Não foi possível atualizar o lembrete',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = (reminder: Reminder) => {
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      due_date: reminder.due_date.split('T')[0],
      due_time: reminder.due_time || '',
      reminder_type: reminder.reminder_type,
    })
    setEditingId(reminder.id)
    setShowForm(true)
  }

  const pendingReminders = reminders.filter((r) => r.status === 'pending')
  const completedReminders = reminders.filter((r) => r.status === 'completed')

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Lembretes</h1>
            <p className="text-gray-400">Mantenha-se atualizado com seus compromissos</p>
          </div>

          <Button
            onClick={() => setShowForm((prev) => !prev)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Novo Lembrete
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Total</p>
            <p className="text-3xl font-bold text-white">{reminders.length}</p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Pendentes</p>
            <p className="text-3xl font-bold text-red-500">{pendingReminders.length}</p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Concluídos</p>
            <p className="text-3xl font-bold text-green-500">{completedReminders.length}</p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Próximos</p>
            <p className="text-3xl font-bold text-blue-500">
              {
                pendingReminders.filter((r) => {
                  const today = new Date().toISOString().split('T')[0]
                  return r.due_date >= today
                }).length
              }
            </p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Mês</Label>
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

            <div className="space-y-2">
              <Label className="text-gray-300">Data inicial</Label>
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

            <div className="space-y-2">
              <Label className="text-gray-300">Data final</Label>
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

            <div className="space-y-2">
              <Label className="text-gray-300">Status</Label>
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

          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMonth('')
                setStartDate('')
                setEndDate('')
                setStatusFilter('all')
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300">Título</Label>
                  <Input
                    placeholder="Título do lembrete"
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
                  <Select
                    value={formData.reminder_type}
                    onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="task">Tarefa</SelectItem>
                      <SelectItem value="meeting">Reunião</SelectItem>
                      <SelectItem value="review">Revisão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Descrição</Label>
                <Input
                  placeholder="Descrição do lembrete"
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
                      : 'Salvando...'
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
          {loading ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center text-gray-400">
              Carregando lembretes...
            </div>
          ) : reminders.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
              <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhum lembrete registrado</p>
            </div>
          ) : (
            <>
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
                        className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex items-center justify-between hover:border-gray-700 transition gap-4 flex-wrap"
                      >
                        <div className="flex-1 min-w-[240px]">
                          <h3 className="text-lg font-semibold text-white">{reminder.title}</h3>
                          <p className="text-gray-400 text-sm mt-1">{reminder.description || '-'}</p>
                          <p className="text-gray-500 text-sm mt-2">
                            Vencimento: {new Date(reminder.due_date).toLocaleDateString('pt-BR')}
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
                        className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6 flex items-center justify-between opacity-75 gap-4 flex-wrap"
                      >
                        <div className="flex-1 min-w-[240px]">
                          <h3 className="text-lg font-semibold text-gray-400 line-through">
                            {reminder.title}
                          </h3>
                          <p className="text-gray-500 text-sm mt-2">
                            Concluído em: {new Date(reminder.due_date).toLocaleDateString('pt-BR')}
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
            </>
          )}
        </div>
      </main>
    </div>
  )
}
