'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { AppStatCard } from '@/components/AppStatCard'
import { Button } from '@/components/ui/button'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  Wallet,
  CalendarClock,
  Target,
} from 'lucide-react'

type Transaction = {
  id: string
  amount: number
  type: 'income' | 'expense'
  description?: string | null
  category?: string | null
  date: string
}

type Bill = {
  id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue'
  due_date: string
  description?: string | null
  supplier_name?: string | null
  client_name?: string | null
}

type Reminder = {
  id: string
  title: string
  due_date: string
  due_time?: string | null
  status: 'pending' | 'sent' | 'completed'
}

type Goal = {
  id: string
  title: string
  target_amount: number
  current_amount: number
  status: 'active' | 'completed' | 'cancelled'
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(Number(value) || 0)
}

function normalizeDateOnly(value?: string | null) {
  if (!value) return ''
  return String(value).split('T')[0]
}

export default function DashboardPage() {
  const router = useRouter()
  const { userId, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('BRL')

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [payableBills, setPayableBills] = useState<Bill[]>([])
  const [receivableBills, setReceivableBills] = useState<Bill[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [goals, setGoals] = useState<Goal[]>([])

  useEffect(() => {
    if (!authLoading && !userId) {
      router.push('/login')
      return
    }

    if (userId) {
      fetchDashboardData()
    }
  }, [authLoading, userId, router])

  const fetchDashboardData = async () => {
    if (!supabase || !userId) return

    setLoading(true)

    try {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const currentMonthStart = `${yyyy}-${mm}-01`
      const currentDate = `${yyyy}-${mm}-${String(today.getDate()).padStart(2, '0')}`

      const [
        userRes,
        transactionsRes,
        payableRes,
        receivableRes,
        remindersRes,
        goalsRes,
      ] = await Promise.all([
        supabase.from('users').select('currency').eq('id', userId).single(),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .gte('date', currentMonthStart)
          .order('date', { ascending: false }),
        supabase
          .from('accounts_payable')
          .select('*')
          .eq('user_id', userId)
          .order('due_date', { ascending: true }),
        supabase
          .from('accounts_receivable')
          .select('*')
          .eq('user_id', userId)
          .order('due_date', { ascending: true }),
        supabase
          .from('reminders')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['pending', 'sent'])
          .order('due_date', { ascending: true }),
        supabase
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['active', 'completed'])
          .order('deadline', { ascending: true }),
      ])

      if (userRes.data?.currency) setCurrency(userRes.data.currency)
      setTransactions((transactionsRes.data || []) as Transaction[])
      setPayableBills((payableRes.data || []) as Bill[])
      setReceivableBills((receivableRes.data || []) as Bill[])
      setReminders((remindersRes.data || []) as Reminder[])
      setGoals((goalsRes.data || []) as Goal[])

      const overduePayableIds =
        (payableRes.data || [])
          .filter(
            (bill: Bill) =>
              bill.status === 'pending' && normalizeDateOnly(bill.due_date) < currentDate,
          )
          .map((bill: Bill) => bill.id) || []

      const overdueReceivableIds =
        (receivableRes.data || [])
          .filter(
            (bill: Bill) =>
              bill.status === 'pending' && normalizeDateOnly(bill.due_date) < currentDate,
          )
          .map((bill: Bill) => bill.id) || []

      if (overduePayableIds.length > 0) {
        await supabase
          .from('accounts_payable')
          .update({ status: 'overdue' })
          .in('id', overduePayableIds)
      }

      if (overdueReceivableIds.length > 0) {
        await supabase
          .from('accounts_receivable')
          .update({ status: 'overdue' })
          .in('id', overdueReceivableIds)
      }

      if (overduePayableIds.length || overdueReceivableIds.length) {
        setPayableBills((prev) =>
          prev.map((bill) =>
            overduePayableIds.includes(bill.id) ? { ...bill, status: 'overdue' } : bill,
          ),
        )
        setReceivableBills((prev) =>
          prev.map((bill) =>
            overdueReceivableIds.includes(bill.id) ? { ...bill, status: 'overdue' } : bill,
          ),
        )
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

    const totalExpense = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

    const pendingPayable = payableBills
      .filter((bill) => bill.status === 'pending' || bill.status === 'overdue')
      .reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0)

    const pendingReceivable = receivableBills
      .filter((bill) => bill.status === 'pending' || bill.status === 'overdue')
      .reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0)

    const activeGoals = goals.filter((goal) => goal.status === 'active')
    const remindersCount = reminders.filter((reminder) => reminder.status !== 'completed').length

    return {
      balance: totalIncome - totalExpense,
      income: totalIncome,
      expense: totalExpense,
      pendingPayable,
      pendingReceivable,
      activeGoals: activeGoals.length,
      remindersCount,
    }
  }, [transactions, payableBills, receivableBills, goals, reminders])

  const recentTransactions = useMemo(() => {
    return [...transactions].slice(0, 5)
  }, [transactions])

  const nextBills = useMemo(() => {
    const items = [
      ...payableBills.map((bill) => ({ ...bill, billType: 'payable' as const })),
      ...receivableBills.map((bill) => ({ ...bill, billType: 'receivable' as const })),
    ]
      .filter((bill) => bill.status === 'pending' || bill.status === 'overdue')
      .sort((a, b) => normalizeDateOnly(a.due_date).localeCompare(normalizeDateOnly(b.due_date)))

    return items.slice(0, 6)
  }, [payableBills, receivableBills])

  const nextReminders = useMemo(() => {
    return reminders
      .filter((item) => item.status === 'pending' || item.status === 'sent')
      .sort((a, b) => normalizeDateOnly(a.due_date).localeCompare(normalizeDateOnly(b.due_date)))
      .slice(0, 5)
  }, [reminders])

  const highlightedGoals = useMemo(() => {
    return goals.slice(0, 4)
  }, [goals])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <p className="text-white">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-[#94a3b8]">Visão geral da sua vida financeira</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <AppStatCard
            title="Saldo do Mês"
            value={formatCurrency(stats.balance, currency)}
            icon={Wallet}
            valueClassName={stats.balance >= 0 ? 'text-amber-500' : 'text-red-500'}
          />
          <AppStatCard
            title="Receitas do Mês"
            value={formatCurrency(stats.income, currency)}
            icon={ArrowUpCircle}
            valueClassName="text-green-500"
          />
          <AppStatCard
            title="Despesas do Mês"
            value={formatCurrency(stats.expense, currency)}
            icon={ArrowDownCircle}
            valueClassName="text-red-500"
          />
          <AppStatCard
            title="Contas a Pagar"
            value={formatCurrency(stats.pendingPayable, currency)}
            icon={Landmark}
            valueClassName="text-orange-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <AppStatCard
            title="Contas a Receber"
            value={formatCurrency(stats.pendingReceivable, currency)}
            valueClassName="text-blue-500"
          />
          <AppStatCard
            title="Lembretes"
            value={stats.remindersCount}
            icon={CalendarClock}
            valueClassName="text-cyan-400"
          />
          <AppStatCard
            title="Metas Ativas"
            value={stats.activeGoals}
            icon={Target}
            valueClassName="text-purple-400"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-1 rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-semibold">Transações Recentes</h2>
              <Button
                onClick={() => router.push('/transactions')}
                className="bg-transparent border border-[#2a3650] text-white hover:bg-[#111827] rounded-xl"
              >
                Ver todas
              </Button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
                Nenhuma transação neste mês.
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">
                        {transaction.description || 'Sem descrição'}
                      </p>
                      <p className="text-sm text-[#94a3b8]">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')} •{' '}
                        {transaction.category || 'Sem categoria'}
                      </p>
                    </div>

                    <p
                      className={`font-bold ${
                        transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}{' '}
                      {formatCurrency(Math.abs(Number(transaction.amount) || 0), currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="xl:col-span-1 rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-semibold">Próximas Contas</h2>
              <Button
                onClick={() => router.push('/bills')}
                className="bg-transparent border border-[#2a3650] text-white hover:bg-[#111827] rounded-xl"
              >
                Ver contas
              </Button>
            </div>

            {nextBills.length === 0 ? (
              <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
                Nenhuma conta pendente.
              </div>
            ) : (
              <div className="space-y-3">
                {nextBills.map((bill) => (
                  <div
                    key={`${bill.billType}-${bill.id}`}
                    className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">
                          {bill.description ||
                            (bill.billType === 'payable' ? bill.supplier_name : bill.client_name) ||
                            'Conta'}
                        </p>
                        <p className="text-sm text-[#94a3b8]">
                          {new Date(bill.due_date).toLocaleDateString('pt-BR')} •{' '}
                          {bill.billType === 'payable' ? 'A pagar' : 'A receber'}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            bill.billType === 'payable' ? 'text-orange-400' : 'text-blue-400'
                          }`}
                        >
                          {formatCurrency(bill.amount, currency)}
                        </p>
                        <span
                          className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                            bill.status === 'overdue'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                          }`}
                        >
                          {bill.status === 'overdue' ? 'Vencida' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="xl:col-span-1 rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-semibold">Próximos Lembretes</h2>
              <Button
                onClick={() => router.push('/reminders')}
                className="bg-transparent border border-[#2a3650] text-white hover:bg-[#111827] rounded-xl"
              >
                Ver lembretes
              </Button>
            </div>

            {nextReminders.length === 0 ? (
              <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
                Nenhum lembrete pendente.
              </div>
            ) : (
              <div className="space-y-3">
                {nextReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-4"
                  >
                    <p className="text-white font-semibold truncate">{reminder.title}</p>
                    <p className="text-sm text-[#94a3b8] mt-1">
                      {new Date(reminder.due_date).toLocaleDateString('pt-BR')}
                      {reminder.due_time ? ` às ${reminder.due_time}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6 mt-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white text-xl font-semibold">Metas em Destaque</h2>
            <Button
              onClick={() => router.push('/goals')}
              className="bg-transparent border border-[#2a3650] text-white hover:bg-[#111827] rounded-xl"
            >
              Ver metas
            </Button>
          </div>

          {highlightedGoals.length === 0 ? (
            <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
              Nenhuma meta cadastrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {highlightedGoals.map((goal) => {
                const target = Number(goal.target_amount) || 0
                const current = Number(goal.current_amount) || 0
                const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0

                return (
                  <div
                    key={goal.id}
                    className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-white font-semibold line-clamp-2">{goal.title}</p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          goal.status === 'completed'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-purple-500/10 text-purple-400'
                        }`}
                      >
                        {goal.status === 'completed' ? 'Concluída' : 'Ativa'}
                      </span>
                    </div>

                    <p className="text-sm text-[#94a3b8] mb-3">
                      {formatCurrency(current, currency)} de {formatCurrency(target, currency)}
                    </p>

                    <div className="w-full h-3 bg-[#111827] rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${
                          goal.status === 'completed' ? 'bg-green-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <p className="text-sm text-white font-medium">{progress.toFixed(1)}%</p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
