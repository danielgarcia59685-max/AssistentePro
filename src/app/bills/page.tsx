'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { FileText, Plus, Trash2, CheckCircle2, Edit } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface Bill {
  id: string
  amount: number
  status: 'pending' | 'paid'
  due_date: string
  description: string
  type: 'payable' | 'receivable'
  is_recurring: boolean
  recurrence_interval?: string
  recurrence_count?: number
  recurrence_end_date?: string
}

export default function BillsPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()
  const [bills, setBills] = useState<Bill[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'payable' | 'receivable'>('payable')
  const [month, setMonth] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [formData, setFormData] = useState({
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    description: '',
    party_name: '',
    is_recurring: false,
    recurrence_interval: 'monthly',
    recurrence_count: '',
    recurrence_end_date: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const dateRange = useMemo(() => {
    if (month) {
      const [yearStr, monthStr] = month.split('-')
      const year = Number(yearStr)
      const monthNumber = Number(monthStr)
      if (!year || !monthNumber) return { start: null, end: null }
      const lastDay = new Date(year, monthNumber, 0).getDate()
      const start = `${yearStr}-${monthStr}-01`
      const end = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`
      return { start, end }
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
      fetchBills()
    }
  }, [activeTab, userId, authLoading, router, dateRange.start, dateRange.end, statusFilter])

  const fetchBills = async () => {
    if (!supabase) return
    if (!userId) return

    try {
      const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'
      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })

      if (dateRange.start) {
        query = query.gte('due_date', dateRange.start)
      }

      if (dateRange.end) {
        query = query.lte('due_date', dateRange.end)
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (!error && data) {
        setBills(data)
      }
    } catch (error) {
      console.error('Erro ao buscar contas:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      toast({ title: 'Sessão expirada', description: 'Faça login novamente para salvar a conta', variant: 'destructive' })
      return
    }
    const authUserId = sessionData.session.user.id
    const authEmail = sessionData.session.user.email || ''
    const fallbackName = authEmail ? authEmail.split('@')[0] : 'Usuário'

    // Validação
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor maior que 0', variant: 'destructive' })
      return
    }
    if (!formData.party_name || formData.party_name.trim().length === 0) {
      toast({ title: 'Nome inválido', description: 'Informe um nome para a conta', variant: 'destructive' })
      return
    }
    if (!formData.due_date) {
      toast({ title: 'Data inválida', description: 'Informe uma data de vencimento', variant: 'destructive' })
      return
    }
    if (formData.is_recurring && formData.recurrence_count && (isNaN(Number(formData.recurrence_count)) || Number(formData.recurrence_count) <= 0)) {
      toast({ title: 'Recorrência inválida', description: 'Informe uma quantidade válida para recorrência', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'
      const billData: Record<string, any> = {
        user_id: authUserId,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        description: formData.description,
      }

      await supabase
        .from('users')
        .upsert([{ id: authUserId, email: authEmail || `${authUserId}@local`, name: fallbackName }])
        .throwOnError()

      if (activeTab === 'payable') {
        billData.supplier_name = formData.party_name
      } else {
        billData.client_name = formData.party_name
      }

      if (editingId) {
        await supabase
          .from(table)
          .update(billData)
          .eq('id', editingId)
          .select('id')
          .single()
          .throwOnError()
      } else {
        await supabase
          .from(table)
          .insert([{ ...billData, status: 'pending' }])
          .select('id')
          .single()
          .throwOnError()
      }

      resetForm()
      fetchBills()
      toast({ title: 'Sucesso', description: 'Conta salva com sucesso' })
    } catch (error) {
      const message = (error as any)?.message || JSON.stringify(error)
      console.error('Erro ao salvar conta:', error)
      toast({ title: 'Erro', description: message || 'Não foi possível salvar a conta', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({ amount: '', due_date: new Date().toISOString().split('T')[0], description: '', party_name: '', is_recurring: false, recurrence_interval: 'monthly', recurrence_count: '', recurrence_end_date: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (bill: Bill) => {
    setFormData({
      amount: bill.amount.toString(),
      due_date: bill.due_date.split('T')[0],
      description: bill.description,
      party_name: activeTab === 'payable' ? (bill as Bill & { supplier_name?: string }).supplier_name || '' : (bill as Bill & { client_name?: string }).client_name || '',
      is_recurring: bill.is_recurring || false,
      recurrence_interval: bill.recurrence_interval || 'monthly',
      recurrence_count: bill.recurrence_count?.toString() || '',
      recurrence_end_date: bill.recurrence_end_date || '',
    })
    setEditingId(bill.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm('Tem certeza?')) return

    try {
      const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'
      await supabase.from(table).delete().eq('id', id)
      fetchBills()
    } catch (error) {
      console.error('Erro ao deletar:', error)
    }
  }

  const handleMarkAsPaid = async (id: string) => {
    if (!supabase) return

    try {
      const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'
      await supabase.from(table).update({ status: 'paid' }).eq('id', id)
      fetchBills()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  const pendingBills = bills.filter(b => b.status === 'pending')
  const paidBills = bills.filter(b => b.status === 'paid')
  const totalAmount = bills.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0)
  const totalPaid = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0)

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Contas</h1>
            <p className="text-gray-400">Gerenciamento de Contas a Pagar e Receber</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nova Conta
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          {(['payable', 'receivable'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium text-lg transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-amber-600 border-amber-600'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              {tab === 'payable' ? 'A Pagar' : 'A Receber'}
            </button>
          ))}
        </div>

        {/* Filters */}
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
              <Select value={statusFilter} onValueChange={(value: 'all' | 'pending' | 'paid') => setStatusFilter(value)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Total {activeTab === 'payable' ? 'A Pagar' : 'A Receber'}</p>
            <p className="text-3xl font-bold text-amber-600">R$ {totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Pendente</p>
            <p className="text-3xl font-bold text-red-500">{pendingBills.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <p className="text-gray-400 text-sm mb-2">Pago</p>
            <p className="text-3xl font-bold text-green-500">{paidBills.length}</p>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300">{activeTab === 'payable' ? 'Fornecedor' : 'Cliente'}</Label>
                  <Input
                    placeholder={activeTab === 'payable' ? 'Ex: Conta de luz, Fornecedor X' : 'Ex: Cliente Y'}
                    value={formData.party_name}
                    onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                    required
                    className="bg-gray-800 border-gray-700 text-white rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Valor</Label>
                  <Input type="number" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Data de Vencimento</Label>
                  <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Descrição</Label>
                <Input placeholder="Descrição" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring" checked={formData.is_recurring} onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })} className="rounded" />
                <Label htmlFor="recurring" className="text-gray-300">Recorrente</Label>
              </div>
              {formData.is_recurring && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Intervalo</Label>
                    <Select value={formData.recurrence_interval} onValueChange={(value) => setFormData({ ...formData, recurrence_interval: value })}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Quantidade</Label>
                    <Input type="number" placeholder="Ex: 12" value={formData.recurrence_count} onChange={(e) => setFormData({ ...formData, recurrence_count: e.target.value })} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Data Final</Label>
                    <Input type="date" value={formData.recurrence_end_date} onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })} className="bg-gray-800 border-gray-700 text-white rounded-xl" />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl">{isSubmitting ? (editingId ? 'Atualizando...' : 'Adicionando...') : (editingId ? 'Atualizar' : 'Adicionar')}</Button>
                <Button type="button" onClick={() => resetForm()} className="border border-gray-700 text-gray-300 hover:bg-gray-800 px-6 py-3 rounded-xl">Cancelar</Button>
              </div>
            </form>
          </div>
        )}

        {/* Bills List */}
        <div className="space-y-4">
          {bills.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma conta registrada</p>
            </div>
          ) : (
            bills.map(bill => (
              <div key={bill.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex items-center justify-between hover:border-gray-700 transition">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{bill.description}</h3>
                  <p className="text-gray-400 text-sm">Vencimento: {new Date(bill.due_date).toLocaleDateString('pt-BR')}</p>
                  {bill.is_recurring && <p className="text-amber-600 text-sm">Recorrente: {bill.recurrence_interval}</p>}
                </div>
                <div className="flex items-center gap-6">
                  <span className={`text-2xl font-bold ${bill.status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>
                    R$ {bill.amount.toFixed(2)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    bill.status === 'paid'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {bill.status === 'paid' ? 'Pago' : 'Pendente'}
                  </span>
                  <Button size="sm" onClick={() => handleEdit(bill)} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30 rounded-lg">
                    <Edit className="w-4 h-4" />
                  </Button>
                  {bill.status === 'pending' && (
                    <Button size="sm" onClick={() => handleMarkAsPaid(bill.id)} className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleDelete(bill.id)} className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg">
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
