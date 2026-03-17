'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  Landmark,
  Wallet,
} from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { AppStatCard } from '@/components/AppStatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

    const sb = supabase

    const fetchData = async () => {
      const { data: txData, error: txError } = await sb
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

      const { data: allMonth, error: monthError } = await sb
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)

      if (!monthError && allMonth) {
        let income = 0
        let expense = 0

        for (const tx of allMonth as Array<{ amount: any; type: any }>) {
          if (tx.type === 'income') income += Number(tx.amount) || 0
          else if (tx.type === 'expense') expense += Number(tx.amount) || 0
        }

        setCurrentMonthSummary({ income, expense, balance: income - expense })
      } else {
        setCurrentMonthSummary({ income: 0, expense: 0, balance: 0 })
      }

      const { data: remData, error: remError } = await sb
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
        .limit(6)

      if (!remError && remData) setWeekReminders(remData as Reminder[])
      else setWeekReminders([])

      const { data: apData, error: apError } = await sb
        .from('accounts_payable')
        .select(
          'id, user_id, supplier_name, amount, due_date, status, payment_method, payment_date, description, created_at',
        )
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('due_date', weekStart)
        .lte('due_date', weekEnd)
        .order('due_date', { ascending: true })
        .limit(6)

      if (!apError && apData) setWeekPayables(apData as AccountPayable[])
      else setWeekPayables([])
    }

    fetchData()
  }, [authLoading, userId, weekStart, weekEnd])

  return (
    <div className="bg-app min-h-screen">
      <Navigation />

      <main className="app-shell">
        <section className="page-header">
          <div>
            <div className="premium-chip mb-4">Visão geral financeira</div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              Bem-vindo ao AssistentePro{userEmail ? ` (${userEmail})` : ''}. Acompanhe sua vida
              financeira com clareza.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/transactions">Nova transação</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports">Ver relatórios</Link>
            </Button>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
          <AppStatCard
            title="Receitas do mês"
            value={formatCurrencyBRL(currentMonthSummary.income)}
            subtitle="Entradas registradas no período atual"
            icon={ArrowUpRight}
            valueClassName="metric-positive"
            iconClassName="text-emerald-300"
          />
          <AppStatCard
            title="Despesas do mês"
            value={formatCurrencyBRL(currentMonthSummary.expense)}
            subtitle="Saídas registradas no período atual"
            icon={ArrowDownRight}
            valueClassName="metric-negative"
            iconClassName="text-rose-300"
          />
          <AppStatCard
            title="Saldo atual"
            value={formatCurrencyBRL(currentMonthSummary.balance)}
            subtitle="Receitas menos despesas"
            icon={Wallet}
            valueClassName={
              currentMonthSummary.balance >= 0 ? 'metric-primary' : 'metric-negative'
            }
            iconClassName="text-blue-300"
          />
          <AppStatCard
            title="Compromissos da semana"
            value={weekReminders.length}
            subtitle="Itens pendentes nos próximos 7 dias"
            icon={CalendarClock}
            valueClassName="metric-accent"
            iconClassName="text-violet-300"
          />
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Contas da semana</CardTitle>
                <p className="section-subtitle">
                  Vencimentos entre{' '}
                  {new Date(weekStart).toLocaleDateString('pt-BR')} e{' '}
                  {new Date(weekEnd).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60">
                <CreditCard className="h-5 w-5 text-blue-300" />
              </div>
            </CardHeader>

            <CardContent>
              {weekPayables.length === 0 ? (
                <div className="premium-panel-soft p-8 text-center text-slate-400">
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
                        <p className="truncate font-semibold text-white">
                          {bill.supplier_name || 'Conta'}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Vence em:{' '}
                          {bill.due_date
                            ? new Date(bill.due_date).toLocaleDateString('pt-BR')
                            : '-'}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-white">
                          {formatCurrencyBRL(Number(bill.amount || 0))}
                        </p>
                        <span className="premium-chip-warning mt-2 inline-flex">Pendente</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <Button asChild variant="outline">
                  <Link href="/bills">Ver todas as contas</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Compromissos da semana</CardTitle>
                <p className="section-subtitle">
                  Pendências programadas para os próximos 7 dias
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60">
                <CalendarClock className="h-5 w-5 text-violet-300" />
              </div>
            </CardHeader>

            <CardContent>
              {weekReminders.length === 0 ? (
                <div className="premium-panel-soft p-8 text-center text-slate-400">
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
                        <p className="truncate font-semibold text-white">{reminder.title}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {reminder.due_date
                            ? new Date(reminder.due_date).toLocaleDateString('pt-BR')
                            : '-'}
                          {reminder.due_time ? ` • ${reminder.due_time}` : ''}
                          {reminder.reminder_type ? ` • ${reminder.reminder_type}` : ''}
                        </p>
                        {reminder.description ? (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {reminder.description}
                          </p>
                        ) : null}
                      </div>

                      <span className="premium-chip-warning">Pendente</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <Button asChild variant="outline">
                  <Link href="/reminders">Ver compromissos</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Transações recentes</CardTitle>
                <p className="section-subtitle">Últimas 10 movimentações registradas</p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60">
                <Landmark className="h-5 w-5 text-blue-300" />
              </div>
            </CardHeader>

            <CardContent>
              {transactions.length === 0 ? (
                <div className="premium-panel-soft p-10 text-center text-slate-400">
                  Nenhuma transação registrada ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="premium-panel-soft flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {tx.description || 'Sem descrição'}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {tx.category || 'Sem categoria'} •{' '}
                          {new Date(tx.date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            tx.type === 'income' ? 'metric-positive' : 'metric-negative'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatCurrencyBRL(Math.abs(Number(tx.amount)))}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {tx.type === 'income' ? 'Receita' : 'Despesa'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <Button asChild>
                  <Link href="/transactions">Ir para transações</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
