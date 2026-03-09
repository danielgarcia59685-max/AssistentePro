'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Check, Clock, LogOut, Plus, Trash2 } from 'lucide-react'

interface AccountPayable {
  id: string
  supplier_name: string
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue'
  description: string
  payment_method?: string
  is_recurring?: boolean
  recurrence_interval?: string
  recurrence_count?: number
  recurrence_end_date?: string
}

interface AccountReceivable {
  id: string
  client_name: string
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue'
  description: string
  is_recurring?: boolean
  recurrence_interval?: string
  recurrence_count?: number
  recurrence_end_date?: string
}

export default function BillsPage() {
  const { userId, userEmail, logout, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'payable' | 'receivable'>('payable')
  const [accountsPayable, setAccountsPayable] = useState<AccountPayable[]>([])
  const [accountsReceivable, setAccountsReceivable] = useState<AccountReceivable[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    description: '',
    payment_method: 'pix',
    is_recurring: false,
    recurrence_interval: 'monthly',
    recurrence_count: '',
    recurrence_end_date: '',
  })

  useEffect(() => {
    if (!authLoading && userId) {
      fetchData()
    }
  }, [authLoading, userId])

  const fetchData = async () => {
    if (!supabase || !userId) return
    const sb = supabase // garante tipo não-nulo neste escopo

    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data: payable } = await sb
        .from('accounts_payable')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })

      const { data: receivable } = await sb
        .from('accounts_receivable')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })

      payable?.forEach(async (item) => {
        if (item.status === 'pending' && item.due_date < today) {
          await sb.from('accounts_payable').update({ status: 'overdue' }).eq('id', item.id)
        }
      })

      receivable?.forEach(async (item) => {
        if (item.status === 'pending' && item.due_date < today) {
          await sb.from('accounts_receivable').update({ status: 'overdue' }).eq('id', item.id)
        }
      })

      setAccountsPayable(payable || [])
      setAccountsReceivable(receivable || [])
    } catch (error) {
      console.error('Erro ao carregar contas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !userId) return

    try {
      const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'
      const nameField = activeTab === 'payable' ? 'supplier_name' : 'client_name'

      const insertPayload: any = {
        user_id: userId,
        [nameField]: formData.name,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        description: formData.description,
        payment_method: formData.payment_method,
        status: 'pending',
        is_recurring: formData.is_recurring,
      }

      if (formData.is_recurring) {
        insertPayload.recurrence_interval = formData.recurrence_interval
        if (formData.recurrence_count) insertPayload.recurrence_count = parseInt(formData.recurrence_count)
        if (formData.recurrence_end_date) insertPayload.recurrence_end_date = formData.recurrence_end_date
      }

      await supabase.from(table).insert([insertPayload])

      setFormData({
        name: '',
        amount: '',
        due_date: new Date().toISOString().split('T')[0],
        description: '',
        payment_method: 'pix',
        is_recurring: false,
        recurrence_interval: 'monthly',
        recurrence_count: '',
        recurrence_end_date: '',
      })
      setShowAddForm(false)
      fetchData()
    } catch (error) {
      console.error('Erro ao adicionar conta:', error)
    }
  }

  const handleMarkAsPaid = async (id: string) => {
    if (!supabase) return
    const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'

    try {
      await supabase
        .from(table)
        .update({ status: 'paid', payment_date: new Date().toISOString().split('T')[0] })
        .eq('id', id)
      fetchData()
    } catch (error) {
      console.error('Erro ao marcar como pago:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'

    try {
      await supabase.from(table).delete().eq('id', id)
      fetchData()
    } catch (error) {
      console.error('Erro ao deletar conta:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700'
      case 'overdue':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-yellow-100 text-yellow-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Pago'
      case 'overdue':
        return 'Vencido'
      default:
        return 'Pendente'
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  const displayData = activeTab === 'payable' ? accountsPayable : accountsReceivable

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              {activeTab === 'payable' ? 'Contas a Pagar' : 'Contas a Receber'}
            </h1>
            <p className="text-gray-600 mt-1">{userEmail}</p>
          </div>
          <Button onClick={logout} variant="outline" className="flex items-center gap-2">
            Sair
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button onClick={() => setActiveTab('payable')} className={activeTab === 'payable' ? 'bg-indigo-600 text-white' : 'bg-white'}>
            Contas a Pagar
          </Button>
          <Button onClick={() => setActiveTab('receivable')} className={activeTab === 'receivable' ? 'bg-indigo-600 text-white' : 'bg-white'}>
            Contas a Receber
          </Button>
        </div>

        {/* List */}
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle>{displayData.length} registros</CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhum registro encontrado</div>
            ) : (
              <div className="space-y-3">
                {displayData.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-gray-2 hover:bg-gray-50 transition-colors gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${item.status === 'paid' ? 'bg-green-100' : 'bg-yellow-100'}`} />
                        <div>
                          <h3 className="font-semibold">
                            {activeTab === 'payable'
                              ? (item as AccountPayable).supplier_name
                              : (item as AccountReceivable).client_name}
                          </h3>
                          <p className="text-sm text-gray-600">{(item as any).description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-bold">R$ {item.amount.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(item.due_date).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                      <Button size="sm" onClick={() => handleMarkAsPaid(item.id)} variant="outline">
                        Marcar pago
                      </Button>
                      <Button size="sm" onClick={() => handleDelete(item.id)} variant="outline" className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
