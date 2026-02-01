'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Navigation } from '@/components/Navigation'
import { Plus, Trash2, Check, AlertCircle, LogOut } from 'lucide-react'

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
  const { userId, userEmail, logout, loading: authLoading } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

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
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !userId) return

    try {
      await supabase
        .from('reminders')
        .insert([{
          user_id: userId,
          title: formData.title,
          description: formData.description,
          reminder_type: formData.reminder_type,
          due_date: formData.due_date,
          due_time: formData.due_time,
          status: 'pending',
          send_notification: true,
        }])

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
      await supabase
        .from('reminders')
        .update({ status: 'completed' })
        .eq('id', id)

      fetchReminders()
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return

    try {
      await supabase
        .from('reminders')
        .delete()
        .eq('id', id)

      fetchReminders()
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const getReminderIcon = (type: string) => {
    switch (type) {
      case 'bill_payment':
        return '💰'
      case 'meeting':
        return '📅'
      case 'review':
        return '📊'
      default:
        return '📝'
    }
  }

  const getReminderLabel = (type: string) => {
    switch (type) {
      case 'bill_payment':
        return 'Pagamento'
      case 'meeting':
        return 'Reunião'
      case 'review':
        return 'Análise'
      default:
        return 'Personalizado'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'sent':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-yellow-100 text-yellow-700'
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">📅 Compromissos</h1>
              <p className="text-gray-600 mt-1">Organize suas reuniões e lembretes</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo
              </Button>
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <Card className="bg-white shadow-lg">
              <CardHeader>
                <CardTitle>Adicionar Compromisso</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddReminder} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        placeholder="Nome do compromisso"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo</Label>
                      <Select value={formData.reminder_type} onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meeting">Reunião</SelectItem>
                          <SelectItem value="bill_payment">Pagamento</SelectItem>
                          <SelectItem value="review">Análise</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="due_date">Data</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="due_time">Hora</Label>
                      <Input
                        id="due_time"
                        type="time"
                        value={formData.due_time}
                        onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      placeholder="Detalhes do compromisso"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Reminders List */}
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <Card className="bg-white shadow-lg">
                <CardContent className="text-center py-8 text-gray-500">
                  Nenhum compromisso agendado
                </CardContent>
              </Card>
            ) : (
              reminders.map((reminder) => (
                <Card key={reminder.id} className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getReminderIcon(reminder.reminder_type)}</span>
                        <div>
                          <h3 className="font-semibold text-lg">{reminder.title}</h3>
                          <p className="text-sm text-gray-600">{reminder.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(reminder.status)}`}>
                          {reminder.status === 'completed' ? '✓ Concluído' : reminder.status === 'sent' ? 'Enviado' : 'Pendente'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(reminder.due_date).toLocaleDateString('pt-BR')} {reminder.due_time && `às ${reminder.due_time}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {reminder.status !== 'completed' && (
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsCompleted(reminder.id)}
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleDelete(reminder.id)}
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
