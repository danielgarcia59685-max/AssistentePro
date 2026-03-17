'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Edit, FileText, Plus, Search, Trash2 } from 'lucide-react'
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
    } catch {}
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

      if (activeTab === 'payable') billData.supplier_name = formData.party_name
      else billData.client_name = formData.party_name

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
    } catch {}
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
    } catch {}
  }

  const pendingBills = bills.filter((b) => b.status === 'pending')
  const overdueBills = bills.filter((b) => b.status === 'overdue')
  const paidBills = bills.filter((b) => b.status === 'paid')
  const totalAmount = bills
    .filter((b) => b.status === 'pending' || b.status === 'overdue')
    .reduce((sum, b) => sum + b.amount, 0)

  return (
    <div className="bg-app min-h-screen">
      <Navigation />

      <main className="app-shell">
        <section className="page-header">
          <div>
            <div className="premium-chip mb-4">Contas a pagar e receber</div>
            <h1 className="page-title">Contas</h1>
            <p className="page-subtitle">
              Controle vencimentos, pagamentos, recorrências e recebimentos em um só lugar.
            </p>
          </div>

          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            Nova conta
          </Button>
        </section>

        <section className="mb-6 flex flex-wrap gap-3">
          {(['payable', 'receivable'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-5 py-3 text-sm font-medium transition ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-600/20 to-violet-600/20 text-blue-300 border border-blue-500/20'
                  : 'border border-white/10 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              {tab === 'payable' ? 'A pagar' : 'A receber'}
            </button>
          ))}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <AppStatCard
            title={`Total ${activeTab === 'payable' ? 'a pagar' : 'a receber'}`}
            value={formatCurrency(totalAmount, currency)}
            subtitle="Em aberto no período"
            valueClassName="metric-warning"
          />
          <AppStatCard
            title="Pendentes"
            value={pendingBills.length}
            subtitle="Ainda não pagos"
            valueClassName="metric-negative"
          />
          <AppStatCard
            title="Vencidos"
            value={overdueBills.length}
            subtitle="Exigem atenção"
            valueClassName="text-orange-400"
          />
          <AppStatCard
            title="Pagos"
            value={paidBills.length}
            subtitle="Já concluídos"
            valueClassName="metric-positive"
          />
        </section>

        <section className="premium-panel mb-8 p-6">
          <div className="mb-5">
            <h2 className="section-title">Filtros</h2>
            <p className="section-subtitle">Encontre contas por status, período ou texto</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-slate-300">Pesquisar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Descrição, fornecedor ou cliente"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

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
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | AccountStatus) => setStatusFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="w-full md:w-64 space-y-2">
              <Label className="text-slate-300">Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (e.target.value) setMonth('')
                }}
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
            >
              Limpar filtros
            </Button>
          </div>
        </section>

        {showForm ? (
          <section className="premium-panel mb-8 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Editar conta' : 'Nova conta'}
              </h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    {activeTab === 'payable' ? 'Destinatário' : 'Pagador'}
                  </Label>
                  <Input
                    placeholder={
                      activeTab === 'payable'
                        ? 'Ex: aluguel, conta de luz, João'
                        : 'Ex: cliente, empresa'
                    }
                    value={formData.party_name}
                    onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Valor</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Método de pagamento</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Descrição</Label>
                <Input
                  placeholder="Descrição da conta"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="h-4 w-4 rounded border-white/10 bg-slate-900"
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? editingId
                      ? 'Atualizando...'
                      : 'Salvando...'
                    : editingId
                      ? 'Atualizar conta'
                      : 'Salvar conta'}
                </Button>

                <Button type="button" variant="outline" onClick={resetForm}>
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
                className="premium-panel flex flex-col gap-4 p-6 xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white">
                    {bill.description ||
                      (activeTab === 'payable' ? bill.supplier_name : bill.client_name) ||
                      'Conta'}
                  </h3>

                  {(bill.supplier_name || bill.client_name) && (
                    <p className="mt-1 text-sm text-slate-400">
                      {activeTab === 'payable' ? bill.supplier_name : bill.client_name}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>Vencimento: {formatDateBR(bill.due_date)}</span>
                    {bill.is_recurring ? (
                      <span className="premium-chip-warning">Recorrente: {bill.recurrence_interval}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-4 xl:items-end">
                  <p
                    className={`text-2xl font-bold ${
                      bill.status === 'paid'
                        ? 'metric-positive'
                        : bill.status === 'overdue'
                          ? 'text-orange-400'
                          : 'metric-warning'
                    }`}
                  >
                    {formatCurrency(bill.amount, currency)}
                  </p>

                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      bill.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : bill.status === 'overdue'
                          ? 'bg-orange-500/10 text-orange-300 border border-orange-500/20'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    }`}
                  >
                    {bill.status === 'paid'
                      ? 'Pago'
                      : bill.status === 'overdue'
                        ? 'Vencido'
                        : 'Pendente'}
                  </span>

                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" onClick={() => handleEdit(bill)}>
                      <Edit className="h-4 w-4" />
                    </Button>

                    {(bill.status === 'pending' || bill.status === 'overdue') ? (
                      <Button size="icon" variant="outline" onClick={() => handleMarkAsPaid(bill.id)}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    ) : null}

                    <Button size="icon" variant="outline" onClick={() => handleDelete(bill.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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

  if (!formData.is_recurring) return [base]

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
