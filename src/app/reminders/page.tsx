'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
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
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Check, Clock3 } from 'lucide-react'
import { CompactFilterBar } from '@/components/CompactFilterBar'
import { AppStatCard } from '@/components/AppStatCard'

interface Reminder {
  id: string
  title: string
  description: string
  reminder_type: string
  due_date: string
  due_time?: string
  status: 'pending' | 'sent' | 'completed'
}

export default function RemindersPage() {
  const { userId, loading: authLoading } = useAuth()

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddForm, setShowAddForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent' | 'completed'>(
    'all',
  )

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminder_type: 'meeting',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '09:00',
  })

  useEffect(() => {
    if (!authLoading && userId) {
      fetchReminders()
    }
  }, [authLoading, userId])

  const fetchReminders = async () => {
    if (!supabase || !userId) return

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })

      if (error) {
        console.error('Erro ao carregar lembretes:', error)
      } else {
        setReminders(data || [])
      }
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !userId) return

    try {
      await supabase.from('reminders').insert([
        {
          user_id: userId,
          title: formData.title,
          description: formData.description,
          reminder_type: formData.reminder_type,
          due_date: formData.due_date,
          due_time: formData.due_time,
          status: 'pending',
          send_notification: true,
        },
      ])

      setFormData({
        title: '',
        description: '',
        reminder_type: 'meeting',
        due_date: new Date().toISOString().split('T')[0],
        due_time: '09:00',
      })

      setShowAddForm(false)
      fetchReminders()
    } catch (error) {
      console.error('Erro ao adicionar lembrete:', error)
    }
  }

  const handleMarkAsCompleted = async (id: string) => {
    if (!supabase) return

    try {
      await supabase.from('reminders').update({ status: 'completed' }).eq('id', id)
      fetchReminders()
    } catch (error) {
      console.error('Erro ao atualizar lembrete:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return

    try {
      await supabase.from('reminders').delete().eq('id', id)
      fetchReminders()
    } catch (error) {
      console.error('Erro ao deletar lembrete:', error)
    }
  }

  const visibleReminders = useMemo(() => {
    let rows = [...reminders]

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      rows = rows.filter((r) => {
        return (
          (r.title || '').toLowerCase().includes(term) ||
          (r.description || '').toLowerCase().includes(term)
        )
      })
    }

    if (statusFilter !== 'all') {
      rows = rows.filter((r) => r.status === statusFilter)
    }

    if (month) {
      rows = rows.filter((r) => (r.due_date || '').startsWith(month))
    } else {
      if (startDate) rows = rows.filter((r) => r.due_date >= startDate)
      if (endDate) rows = rows.filter((r) => r.due_date <= endDate)
    }

    return rows
  }, [reminders, search, statusFilter, month, startDate, endDate])

  const total = reminders.length
  const pending = reminders.filter((r) => r.status === 'pending').length
  const completed = reminders.filter((r) => r.status === 'completed').length
  const upcoming = reminders.filter((r) => r.status === 'pending').length

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-white">Carregando...</div>
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
            <h1 className="text-4xl font-bold text-white mb-2">Lembretes</h1>
            <p className="text-[#94a3b8]">Organize seus compromissos e notificações</p>
          </div>

          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-6 py-3 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Lembrete
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <AppStatCard title="Total" value={total} />
          <AppStatCard title="Pendentes" value={pending} valueClassName="text-red-500" />
          <AppStatCard title="Concluídos" value={completed} valueClassName="text-green-500" />
          <AppStatCard title="Próximos" value={upcoming} valueClassName="text-blue-500" />
        </div>

        <CompactFilterBar
          search={search}
          onSearchChange={setSearch}
          onToggleFilters={() => setShowFilters((prev) => !prev)}
          onClear={() => {
            setSearch('')
            setMonth('')
            setStartDate('')
            setEndDate('')
            setStatusFilter('all')
          }}
          showFilters={showFilters}
          placeholder="Buscar por título ou descrição"
          searchClassName="lg:max-w-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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

            <div>
              <Label className="text-gray-300 text-sm mb-2 block">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'pending' | 'sent' | 'completed') =>
                  setStatusFilter(value)
                }
              >
                <SelectTrigger className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111827] border-[#2a3650]">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CompactFilterBar>

        {showAddForm && (
          <div className="bg-[#08152d] rounded-2xl border border-[#1f2a44] p-6 mb-8">
            <form onSubmit={handleAddReminder} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300">Título</Label>
                  <Input
                    placeholder="Nome do compromisso"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Tipo</Label>
                  <Select
                    value={formData.reminder_type}
                    onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}
                  >
                    <SelectTrigger className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111827] border-[#2a3650]">
                      <SelectItem value="meeting">Reunião</SelectItem>
                      <SelectItem value="bill_payment">Pagamento</SelectItem>
                      <SelectItem value="review">Análise</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Data</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                    className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Hora</Label>
                  <Input
                    type="time"
                    value={formData.due_time}
                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                    className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Descrição</Label>
                <Textarea
                  placeholder="Detalhes do compromisso"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-[#1a263d] border-[#2a3650] text-white rounded-xl"
                />
              </div>

              <div className="flex gap-3 flex-wrap">
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                >
                  Salvar
                </Button>

                <Button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="border border-[#2a3650] bg-black text-white hover:bg-[#111827] rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          {visibleReminders.length === 0 ? (
            <div className="bg-[#08152d] rounded-2xl border border-[#1f2a44] p-12 text-center text-[#64748b]">
              Nenhum lembrete registrado
            </div>
          ) : (
            visibleReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="bg-[#08152d] rounded-2xl border border-[#1f2a44] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white">{reminder.title}</h3>

                  {reminder.description ? (
                    <p className="text-[#94a3b8] text-sm mt-1">{reminder.description}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-3 mt-3 text-sm text-[#94a3b8]">
                    <span className="flex items-center gap-1">
                      <Clock3 className="w-4 h-4" />
                      {new Date(reminder.due_date).toLocaleDateString('pt-BR')}
                      {reminder.due_time ? ` às ${reminder.due_time}` : ''}
                    </span>

                    <span className="text-amber-400">{reminder.reminder_type}</span>

                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        reminder.status === 'completed'
                          ? 'bg-green-500/10 text-green-400'
                          : reminder.status === 'sent'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                      }`}
                    >
                      {reminder.status === 'completed'
                        ? 'Concluído'
                        : reminder.status === 'sent'
                          ? 'Enviado'
                          : 'Pendente'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {reminder.status !== 'completed' && (
                    <Button
                      size="sm"
                      onClick={() => handleMarkAsCompleted(reminder.id)}
                      className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => handleDelete(reminder.id)}
                    className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
