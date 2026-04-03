'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  CreditCard,
  DollarSign,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { AppStatCard } from '@/components/AppStatCard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrencyBRL } from '@/lib/format'

type Transaction = {
  id: string
  user_id: string
  amount: number
  type: 'income' | 'expense'
  category: string | null
  description: string | null
  date: string
}

type Reminder = {
  id: string
  user_id: string
  title: string
  description: string | null
  reminder_type: string | null
  due_date: string | null
  due_time: string | null
  status: string | null
  send_notification: boolean | null
  created_at?: string | null
}

type AccountPayable = {
  id: string
  user_id: string
  supplier_name: string | null
  amount: number | null
  due_date: string | null
  status: string | null
  payment_method?: string | null
  payment_date?: string | null
  description?: string | null
  created_at?: string | null
}

function toYMD(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateBR(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR')
}

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState<string>('')
  const { userId, loading: authLoading } = useAuth()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [currentMonthSummary, setCurrentMonthSummary] = useState({
    income: 0,
    expense: 0,
    balance: 0,
  })

  const [weekReminders, setWeekReminders] = useState<Reminder[]>([])
  const [weekPayables, setWeekPayables] = useState<AccountPayable[]>([])

  const { weekStart, weekEnd } = useMemo(() => {
    const start = new Date()
    const end = addDays(start, 7)
    return { weekStart: toYMD(start), weekEnd: toYMD(end) }
  }, [])

  useEffect(() => {
    if (!userId || !supabase) return

    supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.email) setUserEmail(data.email)
      })
  }, [userId])

  useEffect(() => {
    if (authLoading || !userId || !supabase) return

    const fetchData = async () => {
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(10)

      if (!txError && txData) setTransactions(txData as Transaction[])

      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const start = `${yyyy}-${mm}-01`
      const end = `${yyyy}-${mm}-31`

      const { data: allMonth, error: monthError } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)

      if (!monthError && allMonth) {
        let income = 0
        let expense = 0

        for (const tx of allMonth as Array<{ amount: number; type: 'income' | 'expense' }>) {
          if (tx.type === 'income') income += Number(tx.amount) || 0
          if (tx.type === 'expense') expense += Number(tx.amount) || 0
        }

        setCurrentMonthSummary({
          income,
          expense,
          balance: income - expense,
        })
      } else {
        setCurrentMonthSummary({
          income: 0,
          expense: 0,
          balance: 0,
        })
      }

      const { data: remData, error: remError } = await supabase
        .from('reminders')
        .select(
          'id, user_id, title, description, reminder_type, due_date, due_time, status, send_notification, created_at',
        )
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('due_date', weekStart)
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true })
        .limit(10)

      if (!remError && remData) setWeekReminders(remData as Reminder[])
      else setWeekReminders([])

      const { data: apData, error: apError } = await supabase
        .from('accounts_payable')
        .select(
          'id, user_id, supplier_name, amount, due_date, status, payment_method, payment_date, description, created_at',
        )
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('due_date', weekStart)
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true })
        .limit(10)

      if (!apError && apData) setWeekPayables(apData as AccountPayable[])
      else setWeekPayables([])
    }

    fetchData()
  }, [authLoading, userId, weekStart, weekEnd])

  return (
    <div className="min-h-screen bg-app">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="premium-chip mb-4">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Visão geral financeira
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">
              Bem-vindo ao AssistentePro{userEmail ? ` (${userEmail})` : ''}. Aqui está o resumo
              financeiro do seu período atual.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/transactions" className="premium-button">
              Nova transação
            </Link>
            <Link href="/reports" className="premium-button-secondary">
              Ver relatórios
            </Link>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AppStatCard
            title="Saldo atual"
            value={formatCurrencyBRL(currentMonthSummary.balance)}
            subtitle="Receitas menos despesas no mês"
            icon={Wallet}
            valueClassName="text-white"
          />
          <AppStatCard
            title="Receitas"
            value={formatCurrencyBRL(currentMonthSummary.income)}
            subtitle="Entradas confirmadas no mês atual"
            icon={ArrowUpCircle}
            valueClassName="text-emerald-400"
          />
          <AppStatCard
            title="Despesas"
            value={formatCurrencyBRL(currentMonthSummary.expense)}
            subtitle="Saídas registradas no mês atual"
            icon={ArrowDownCircle}
            valueClassName="text-rose-400"
          />
          <AppStatCard
            title="Resultado do mês"
            value={formatCurrencyBRL(currentMonthSummary.balance)}
            subtitle={
              currentMonthSummary.balance >= 0
                ? 'Seu mês está com saldo positivo'
                : 'Seu mês está com saldo negativo'
            }
            icon={DollarSign}
            valueClassName={
              currentMonthSummary.balance >= 0 ? 'text-amber-400' : 'text-red-400'
            }
          />
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="premium-panel p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Contas da semana</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Vencimentos de {formatDateBR(weekStart)} até {formatDateBR(weekEnd)}
                </p>
              </div>
              <span className="premium-chip-warning">Próximos 7 dias</span>
            </div>

            {weekPayables.length === 0 ? (
              <div className="premium-panel-soft px-4 py-10 text-center text-slate-500">
                Nenhuma conta pendente para os próximos 7 dias.
              </div>
            ) : (
              <div className="space-y-3">
                {weekPayables.map((bill) => (
                  <div
                    key={bill.id}
                    className="premium-panel-soft flex items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {bill.supplier_name || 'Conta'}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Vence em {formatDateBR(bill.due_date)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-white">
                        {formatCurrencyBRL(Number(bill.amount || 0))}
                      </p>
                      <span className="premium-chip-warning mt-2">pendente</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Link href="/bills" className="premium-button-secondary px-4 py-2.5 text-sm">
                Ver todas
              </Link>
            </div>
          </div>

          <div className="premium-panel p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Compromissos da semana</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Pendentes de {formatDateBR(weekStart)} até {formatDateBR(weekEnd)}
                </p>
              </div>
              <span className="premium-chip">Agenda ativa</span>
            </div>

            {weekReminders.length === 0 ? (
              <div className="premium-panel-soft px-4 py-10 text-center text-slate-500">
                Nenhum compromisso pendente para os próximos 7 dias.
              </div>
            ) : (
              <div className="space-y-3">
                {weekReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="premium-panel-soft flex items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{reminder.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDateBR(reminder.due_date)}
                        {reminder.due_time ? ` • ${reminder.due_time}` : ''}
                        {reminder.reminder_type ? ` • ${reminder.reminder_type}` : ''}
                      </p>

                      {reminder.description ? (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {reminder.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0">
                      <span className="premium-chip-warning">pendente</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Link href="/reminders" className="premium-button-secondary px-4 py-2.5 text-sm">
                Ver todos
              </Link>
            </div>
          </div>
        </section>

        <section className="premium-panel p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                <CalendarClock className="h-5 w-5 text-blue-300" />
                Transações recentes
              </h2>
              <p className="mt-1 text-sm text-slate-400">Últimas 10 transações registradas</p>
            </div>

            <Link href="/transactions" className="premium-button-secondary px-4 py-2.5 text-sm">
              Abrir transações
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="premium-panel-soft px-4 py-12 text-center">
              <p className="text-slate-400">Nenhuma transação registrada ainda.</p>
              <p className="mt-2 text-sm text-slate-500">
                Clique em <span className="text-white">Nova transação</span> para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="px-2 py-3 font-medium">Data</th>
                    <th className="px-2 py-3 font-medium">Descrição</th>
                    <th className="px-2 py-3 font-medium">Categoria</th>
                    <th className="px-2 py-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-white/5 last:border-b-0">
                      <td className="px-2 py-4 text-slate-300">{formatDateBR(tx.date)}</td>
                      <td className="px-2 py-4 text-white">{tx.description || '-'}</td>
                      <td className="px-2 py-4 text-slate-400">{tx.category || '-'}</td>
                      <td className="px-2 py-4 text-right font-semibold">
                        <span className={tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}>
                          {tx.type === 'income' ? '+' : '-'}
                          {formatCurrencyBRL(Math.abs(Number(tx.amount)))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
