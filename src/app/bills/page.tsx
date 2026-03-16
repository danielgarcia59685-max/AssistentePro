'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Edit,
  FileText,
  Plus,
  Search,
  Trash2,
  WalletCards,
  AlertTriangle,
  BadgeCheck,
} from 'lucide-react'
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

type AccountStatus = 'pending' | 'paid' | 'overdue'

interface Bill {
  id: string
  amount: number
  status: AccountStatus
  due_date: string
  description: string
  supplier_name?: string | null
  client_name?: string | null
  payment_method?: string | null
  is_recurring: boolean
  recurrence_interval?: string | null
  recurrence_count?: number | null
  recurrence_end_date?: string | null
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
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all')
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const [formData, setFormData] = useState({
    amount: '',
    due_date: getLocalDateString(),
    description: '',
    party_name: '',
    payment_method: 'pix',
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
      fetchProfileCurrency()
      fetchBills()
    }
  }, [activeTab, userId, authLoading, router, dateRange.start, dateRange.end, statusFilter])

  const fetchProfileCurrency = async () => {
    if (!supabase || !userId) return
    const { data } = await supabase.from('users').select('currency').eq('id', userId).single()
    if (data?.currency) setCurrency(data.currency)
  }

  const fetchBills = async () => {
    if (!supabase || !userId) return

    try {
      const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'

      let query = supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })

      if (dateRange.start) query = query.gte('due_date', dateRange.start)
      if (dateRange.end) query = query.lte('due_date', dateRange.end)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter as AccountStatus)

      const { data, error } = await query

      if (!error && data) {
        const rows = (data as Bill[]).map((bill) => ({
          ...bill,
          due_date: normalizeDateOnly(bill.due_date),
          recurrence_end_date: normalizeDateOnly(bill.recurrence_end_date),
        }))

        const today = getLocalDateString()
        const overdueIds = rows
          .filter((bill) => bill.status === 'pending' && normalizeDateOnly(bill.due_date) < today)
          .map((bill) => bill.id)

        if (overdueIds.length) {
          await supabase
            .from(table)
            .update({ status: 'overdue' as AccountStatus })
            .in('id', overdueIds)
        }

        const updatedData: Bill[] = rows.map((bill) =>
          overdueIds.includes(bill.id) ? { ...bill, status: 'overdue' as AccountStatus } : bill,
        )

        setBills(updatedData)
      }
    } catch (error) {
      console.error('Erro ao buscar contas:', error)
    }
  }

  const visibleBills = useMemo(() => {
    let rows = [...bills]

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      rows = rows.filter((bill) => {
        const title = (
          bill.description ||
          (activeTab === 'payable' ? bill.supplier_name : bill.client_name) ||
          ''
        ).toLowerCase()

        const subtitle = (
          activeTab === 'payable' ? bill.supplier_name || '' : bill.client_name || ''
        ).toLowerCase()

        return title.includes(term) || subtitle.includes(term)
      })
    }

    return rows
  }, [bills, search, activeTab])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente para salvar a conta',
        variant: 'destructive',
      })
      return
    }

    const authUserId = sessionData.session.user.id
    const authEmail = sessionData.session.user.email || ''
    const fallbackName = authEmail ? authEmail.split('@')[0] : 'Usuário'

    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor maior que 0',
        variant: 'destructive',
      })
      return
    }

    if (!formData.party_name || formData.party_name.trim().length === 0) {
      toast({
        title: 'Nome inválido',
        description: 'Informe um nome para a conta',
        variant: 'destructive',
      })
      return
    }

    if (!formData.due_date) {
      toast({
        title: 'Data inválida',
        description: 'Informe uma data de vencimento',
        variant: 'destructive',
      })
      return
    }

    if (
      formData.is_recurring &&
      formData.recurrence_count &&
      (isNaN(Number(formData.recurrence_count)) || Number(formData.recurrence_count) <= 0)
    ) {
      toast({
        title: 'Recorrência inválida',
        description: 'Informe uma quantidade válida para recorrência',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'
      const normalizedDueDate = normalizeDateOnly(formData.due_date)
      const normalizedRecurrenceEndDate = formData.recurrence_end_date
        ? normalizeDateOnly(formData.recurrence_end_date)
        : null

      const billData: Record<string, any> = {
        user_id: authUserId,
        amount: parseFloat(formData.amount),
        due_date: normalizedDueDate,
        description: formData.description,
        payment_method: formData.payment_method,
        is_recurring: formData.is_recurring,
        recurrence_interval: formData.is_recurring ? formData.recurrence_interval : null,
        recurrence_count:
          formData.is_recurring && formData.recurrence_count
            ? parseInt(formData.recurrence_count, 10)
            : null,
        recurrence_end_date: formData.is_recurring ? normalizedRecurrenceEndDate : null,
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
          .update(billData as any)
          .eq('id', editingId)
          .select('id')
          .single()
          .throwOnError()
      } else {
        const payloads = buildRecurringBills(billData, {
          due_date: normalizedDueDate,
          is_recurring: formData.is_recurring,
          recurrence_interval: formData.recurrence_interval,
          recurrence_count: formData.recurrence_count,
          recurrence_end_date: normalizedRecurrenceEndDate || '',
        })

        await supabase.from(table).insert(payloads as any).throwOnError()
      }

      resetForm()
      fetchBills()
      toast({ title: 'Sucesso', description: 'Conta salva com sucesso' })
    } catch (error) {
      const message = (error as any)?.message || JSON.stringify(error)
      toast({
        title: 'Erro',
        description: message || 'Não foi possível salvar a conta',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      amount: '',
      due_date: getLocalDateString(),
      description: '',
      party_name: '',
      payment_method: 'pix',
      is_recurring: false,
      recurrence_interval: 'monthly',
      recurrence_count: '',
      recurrence_end_date: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (bill: Bill) => {
    setFormData({
      amount: bill.amount.toString(),
      due_date: normalizeDateOnly(bill.due_date),
      description: bill.description,
      party_name:
        activeTab === 'payable'
          ? (bill as Bill & { supplier_name?: string }).supplier_name || ''
          : (bill as Bill & { client_name?: string }).client_name || '',
      payment_method: bill.payment_method || 'pix',
      is_recurring: bill.is_recurring || false,
      recurrence_interval: bill.recurrence_interval || 'monthly',
      recurrence_count: bill.recurrence_count?.toString() || '',
      recurrence_end_date: normalizeDateOnly(bill.recurrence_end_date),
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
      toast({ title: 'Sucesso', description: 'Conta removida com sucesso' })
    } catch {
      toast({ title: 'Erro', description: 'Erro ao deletar conta', variant: 'destructive' })
    }
  }

  const handleMarkAsPaid = async (id: string) => {
    if (!supabase) return

    try {
      const table = activeTab === 'payable' ? 'accounts_payable' : 'accounts_receivable'
      await supabase
        .from(table)
        .update({
          status: 'paid' as AccountStatus,
          payment_date: getLocalDateString(),
        })
        .eq('id', id)

      fetchBills()
      toast({ title: 'Sucesso', description: 'Status atualizado com sucesso' })
    } catch {
      toast({ title: 'Erro', description: 'Erro ao atualizar status', variant: 'destructive' })
    }
  }

  const pendingBills = bills.filter((b) => b.status === 'pending')
  const overdueBills = bills.filter((b) => b.status === 'overdue')
  const paidBills = bills.filter((b) => b.status === 'paid')
  const totalAmount = bills
    .filter((b) => b.status === 'pending' || b.status === 'overdue')
    .reduce((sum, b) => sum + b.amount, 0)

  return (
    <div className="min-h-screen bg-app">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="premium-chip mb-4">Gestão de contas</div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Contas</h1>
            <p className="mt-2 text-slate-400">Controle contas a pagar e a receber com visão clara</p>
          </div>

          <Button
            onClick={() => setShowForm(!showForm)}
            className="rounded-2xl border-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 px-6 py-3 text-white hover:opacity-95"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nova Conta
          </Button>
        </section>

        <section className="mb-6 flex gap-3 border-b border-white/10">
          {(['payable', 'receivable'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-t-2xl px-5 py-3 text-sm font-semibold transition ${
                activeTab === tab
                  ? 'border border-b-0 border-white/10 bg-white/5 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'payable' ? 'A pagar' : 'A receber'}
            </button>
          ))}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AppStatCard
            title={`Total ${activeTab === 'payable' ? 'a pagar' : 'a receber'}`}
            value={formatCurrency(totalAmount, currency)}
            subtitle="Pendentes e vencidas"
            icon={WalletCards}
            valueClassName="text-amber-400"
          />
          <AppStatCard
            title="Pendentes"
            value={pendingBills.length}
            subtitle="Aguardando pagamento"
            icon={FileText}
            valueClassName="text-rose-400"
          />
          <AppStatCard
            title="Vencidas"
            value={overdueBills.length}
            subtitle="Exigem atenção"
            icon={AlertTriangle}
            valueClassName="text-orange-400"
          />
          <AppStatCard
            title="Pagas"
            value={paidBills.length}
            subtitle="Quitadas com sucesso"
            icon={BadgeCheck}
            valueClassName="text-emerald-400"
          />
        </section>

        <section className="premium-panel mb-8 p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-white">Filtros</h2>
            <p className="mt-1 text-sm text-slate-400">Busque e organize suas contas por período e status</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label className="mb-2 block text-sm text-slate-300">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Descrição, fornecedor ou cliente"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 rounded-2xl border-white/10 bg-slate-950/50 pl-10 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm text-slate-300">Mês</Label>
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

            <div>
              <Label className="mb-2 block text-sm text-slate-300">Data inicial</Label>
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

            <div>
              <Label className="mb-2 block text-sm text-slate-300">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | AccountStatus) => setStatusFilter(value)}
              >
                <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-white">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-full md:w-56">
              <Label className="mb-2 block text-sm text-slate-300">Data final</Label>
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
                {editingId ? 'Editar conta' : 'Adicionar conta'}
              </h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    {activeTab === 'payable' ? 'Destinatário' : 'Pagador'}
                  </Label>
                  <Input
                    placeholder={
                      activeTab === 'payable' ? 'Ex: Conta de luz, João Silva' : 'Ex: Empresa X'
                    }
                    value={formData.party_name}
                    onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Valor</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Método de pagamento</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-900 text-white">
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Data de vencimento</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                    className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Descrição</Label>
                <Input
                  placeholder="Descrição"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900"
                />
                <Label htmlFor="recurring" className="text-slate-300">
                  Conta recorrente
                </Label>
              </div>

              {formData.is_recurring ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Intervalo</Label>
                    <Select
                      value={formData.recurrence_interval}
                      onValueChange={(value) =>
                        setFormData({ ...formData, recurrence_interval: value })
                      }
                    >
                      <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-slate-900 text-white">
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Quantidade</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 12"
                      value={formData.recurrence_count}
                      onChange={(e) =>
                        setFormData({ ...formData, recurrence_count: e.target.value })
                      }
                      className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Data final</Label>
                    <Input
                      type="date"
                      value={formData.recurrence_end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, recurrence_end_date: e.target.value })
                      }
                      className="h-11 rounded-2xl border-white/10 bg-slate-950/50 text-white"
                    />
                  </div>
                </div>
              ) : null}

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

        <section className="space-y-4">
          {visibleBills.length === 0 ? (
            <div className="premium-panel p-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-slate-600" />
              <p className="text-slate-400">Nenhuma conta registrada</p>
            </div>
          ) : (
            visibleBills.map((bill) => (
              <div
                key={bill.id}
                className="premium-panel flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    {bill.description ||
                      (activeTab === 'payable' ? bill.supplier_name : bill.client_name) ||
                      'Conta'}
                  </h3>

                  {(bill.supplier_name || bill.client_name) ? (
                    <p className="mt-1 text-sm text-slate-500">
                      {activeTab === 'payable' ? bill.supplier_name : bill.client_name}
                    </p>
                  ) : null}

                  <p className="mt-2 text-sm text-slate-400">
                    Vencimento: {formatDateBR(bill.due_date)}
                  </p>

                  {bill.is_recurring ? (
                    <p className="mt-2 text-sm text-amber-400">
                      Recorrente: {bill.recurrence_interval}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <span
                    className={`text-2xl font-bold ${
                      bill.status === 'paid'
                        ? 'text-emerald-400'
                        : bill.status === 'overdue'
                          ? 'text-orange-400'
                          : 'text-rose-400'
                    }`}
                  >
                    {formatCurrency(bill.amount, currency)}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      bill.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : bill.status === 'overdue'
                          ? 'bg-orange-500/10 text-orange-300'
                          : 'bg-rose-500/10 text-rose-300'
                    }`}
                  >
                    {bill.status === 'paid'
                      ? 'Pago'
                      : bill.status === 'overdue'
                        ? 'Vencido'
                        : 'Pendente'}
                  </span>

                  <Button
                    size="sm"
                    onClick={() => handleEdit(bill)}
                    className="h-10 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 text-blue-300 hover:bg-blue-500/15"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  {(bill.status === 'pending' || bill.status === 'overdue') ? (
                    <Button
                      size="sm"
                      onClick={() => handleMarkAsPaid(bill.id)}
                      className="h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-emerald-300 hover:bg-emerald-500/15"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    onClick={() => handleDelete(bill.id)}
                    className="h-10 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-red-300 hover:bg-red-500/15"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  )
}

function buildRecurringBills(
  baseData: Record<string, any>,
  formData: {
    due_date: string
    is_recurring: boolean
    recurrence_interval: string
    recurrence_count: string
    recurrence_end_date: string
  },
) {
  const base: Record<string, any> & { status: AccountStatus } = {
    ...baseData,
    status: 'pending' as const,
  }

  if (!formData.is_recurring) {
    return [base]
  }

  const count = formData.recurrence_count ? parseInt(formData.recurrence_count, 10) : 0
  const endDate = formData.recurrence_end_date || null
  const dates: string[] = []

  if (count > 0) {
    let current = formData.due_date
    for (let i = 0; i < count; i += 1) {
      dates.push(current)
      current = addInterval(current, formData.recurrence_interval)
    }
  } else if (endDate) {
    let current = formData.due_date
    while (current <= endDate) {
      dates.push(current)
      current = addInterval(current, formData.recurrence_interval)
    }
  } else {
    dates.push(formData.due_date)
  }

  return dates.map((date) => ({ ...base, due_date: date }))
}

function addInterval(dateStr: string, interval: string) {
  const [year, month, day] = normalizeDateOnly(dateStr).split('-').map(Number)
  const date = new Date(year, month - 1, day)

  switch (interval) {
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      break
    case 'annual':
      date.setFullYear(date.getFullYear() + 1)
      break
    case 'monthly':
    default:
      date.setMonth(date.getMonth() + 1)
      break
  }

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number(value) || 0)
}
