'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock3 } from 'lucide-react'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrencyBRL } from '@/lib/format'
import { AppStatCard } from '@/components/AppStatCard'

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
  const [userEmail, setUserEmail] = useState('')
  const { userId, loading: authLoading } = useAuth()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState({
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
      .then(({ data }) => {
        if (data?.email) setUserEmail(data.email)
      })
  }, [userId])

  useEffect(() => {
    if (authLoading || !userId || !supabase) return

    const fetchData = async () => {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const start = `${yyyy}-${mm}-01`
      const end = `${yyyy}-${mm}-31`

      const [txRes, monthRes, remRes, billsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(10),

        supabase
          .from('transactions')
          .select('amount, type')
          .eq('user_id', userId)
          .gte('date', start)
          .lte('date', end),

        supabase
          .from('reminders')
          .select(
            'id, user_id, title, description, reminder_type, due_date, due_time, status, send_notification, created_at'
          )
          .eq('user_id', userId)
          .eq('status', 'pending')
          .gte('due_date', weekStart)
          .lte('due_date', weekEnd)
          .order('due_date', { ascending: true })
          .order('due_time', { ascending: true })
          .limit(10),

        supabase
          .from('accounts_payable')
          .select(
            'id, user_id, supplier_name, amount, due_date, status, payment_method, payment_date, description, created_at'
          )
          .eq('user_id', userId)
          .eq('status', 'pending')
          .gte('due_date', weekStart)
          .lte('due_date', weekEnd)
          .order('due_date', { ascending: true })
          .limit(10),
      ])

      setTransactions((txRes.data || []) as Transaction[])
      setWeekReminders((remRes.data || []) as Reminder[])
      setWeekPayables((billsRes.data || []) as AccountPayable[])

      const monthRows = (monthRes.data || []) as Array<{
        amount: number
        type: 'income' | 'expense'
      }>

      let income = 0
      let expense = 0

      for (const row of monthRows) {
        if (row.type === 'income') income += Number(row.amount) || 0
        if (row.type === 'expense') expense += Number(row.amount) || 0
      }

      setSummary({
        income,
        expense,
        balance: income - expense,
      })
    }

    fetchData()
  }, [authLoading, userId, weekStart, weekEnd])

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Página inicial</h1>
          <p className="text-[#94a3b8]">
            Bem-vindo ao AssistentePro{userEmail ? ` (${userEmail})` : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <AppStatCard
            title="Receitas"
            value={formatCurrencyBRL(summary.income)}
            subtitle="Mês atual"
            valueClassName="text-green-500"
          />
          <AppStatCard
            title="Despesas"
            value={formatCurrencyBRL(summary.expense)}
            subtitle="Mês atual"
            valueClassName="text-red-500"
          />
          <AppStatCard
            title="Saldo"
            value={formatCurrencyBRL(summary.balance)}
            subtitle="Receitas - Despesas"
            valueClassName="text-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <section className="rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
            <h2 className="text-white text-2xl font-semibold mb-2">Contas da semana</h2>
            <p className="text-sm text-[#94a3b8] mb-4">
              Vencimentos de {new Date(weekStart).toLocaleDateString('pt-BR')} até{' '}
              {new Date(weekEnd).toLocaleDateString('pt-BR')}
            </p>

            {weekPayables.length === 0 ? (
              <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
                Nenhuma conta pendente para os próximos 7 dias.
              </div>
            ) : (
              <div className="space-y-3">
                {weekPayables.map((bill) => (
                  <div
                    key={bill.id}
                    className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">
                        {bill.supplier_name || 'Conta'}
                      </p>
                      <p className="text-sm text-[#94a3b8]">
                        Vence em:{' '}
                        {bill.due_date
                          ? new Date(bill.due_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-white font-bold">
                        {formatCurrencyBRL(Number(bill.amount || 0))}
                      </p>
                      <p className="text-amber-400 text-sm">pendente</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button asChild className="bg-white/10 hover:bg-white/15 text-white rounded-xl">
                <Link href="/bills">Ver todas</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-3xl border border-[#1f2a44] bg-[#08152d] p-6">
            <h2 className="text-white text-2xl font-semibold mb-2">Compromissos da semana</h2>
            <p className="text-sm text-[#94a3b8] mb-4">
              Pendentes de {new Date(weekStart).toLocaleDateString('pt-BR')} até{' '}
              {new Date(weekEnd).toLocaleDateString('pt-BR')}
            </p>

            {weekReminders.length === 0 ? (
              <div className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-10 text-center text-[#64748b]">
                Nenhum compromisso pendente para os próximos 7 dias.
              </div>
            ) : (
              <div className="space-y-3">
                {weekReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="rounded-2xl border border-[#1f2a44] bg-[#030b1d] px-4 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{reminder.title}</p>
                      <p className="text-sm text-[#94a3b8]">
                        {reminder.due_date
                          ? new Date(reminder.due_date).toLocaleDateString('pt-BR')
                          : '-'}
                        {reminder.due_time ? ` • ${reminder.due_time}` : ''}
                        {reminder.reminder_type ? ` • ${reminder.reminder_type}` : ''}
                      </p>
                      {reminder.description ? (
                        <p className="text-xs text-[#64748b] truncate mt-1">
                          {reminder.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <p className="text-amber-400 text-sm">pendente</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button asChild className="bg-white/10 hover:bg-white/15 text-white rounded-xl">
                <Link href="/reminders">Ver todos</Link>
              </Button>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-[#1f2a44] bg-[#08152d] overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-white text-2xl font-semibold flex items-center gap-2">
                <Clock3 className="w-5 h-5 text-amber-500" />
                Transações recentes
              </h2>
              <p className="text-sm text-[#94a3b8] mt-1">Últimas 10 transações registradas</p>
            </div>

            <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
              <Link href="/transactions">
                Nova Transação
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-[#101b34] border-y border-[#1f2a44]">
                <tr>
                  <th className="px-6 py-4 text-left text-white font-semibold">Data</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Descrição</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Categoria</th>
                  <th className="px-6 py-4 text-right text-white font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-[#64748b]">
                      Nenhuma transação registrada ainda.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#1f2a44] hover:bg-white/[0.02]">
                      <td className="px-6 py-4 text-[#cbd5e1]">
                        {new Date(tx.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-white">{tx.description || '-'}</td>
                      <td className="px-6 py-4 text-[#cbd5e1]">{tx.category || '-'}</td>
                      <td
                        className={`px-6 py-4 text-right font-bold ${
                          tx.type === 'income' ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrencyBRL(Math.abs(Number(tx.amount)))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
