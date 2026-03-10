'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
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
  const { userId, loading: authLoading } = useAuth()

  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [weekReminders, setWeekReminders] = useState<Reminder[]>([])
  const [weekPayables, setWeekPayables] = useState<AccountPayable[]>([])
  const [currentMonthSummary, setCurrentMonthSummary] = useState({
    income: 0,
    expense: 0,
    balance: 0,
  })

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
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.email) setUserEmail(data.email)
      })
  }, [userId])

  useEffect(() => {
    if (authLoading || !userId || !supabase) return

    const fetchData = async () => {
      setLoading(true)

      try {
        const sb = supabase

        const { data: txData } = await sb
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(10)

        setTransactions((txData || []) as Transaction[])

        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const start = `${yyyy}-${mm}-01`
        const end = `${yyyy}-${mm}-31`

        const { data: allMonth } = await sb
          .from('transactions')
          .select('amount, type')
          .eq('user_id', userId)
          .gte('date', start)
          .lte('date', end)

        if (allMonth) {
          let income = 0
          let expense = 0

          for (const tx of allMonth as Array<{ amount: number; type: string }>) {
            if (tx.type === 'income') income += Number(tx.amount) || 0
            if (tx.type === 'expense') expense += Number(tx.amount) || 0
          }

          setCurrentMonthSummary({
            income,
            expense,
            balance: income - expense,
          })
        } else {
          setCurrentMonthSummary({ income: 0, expense: 0, balance: 0 })
        }

        const { data: remData } = await sb
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

        setWeekReminders((remData || []) as Reminder[])

        const { data: apData } = await sb
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

        setWeekPayables((apData || []) as AccountPayable[])
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error)
        setTransactions([])
        setWeekReminders([])
        setWeekPayables([])
        setCurrentMonthSummary({ income: 0, expense: 0, balance: 0 })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authLoading, userId, weekStart, weekEnd])

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-white mb-2">Página inicial</h1>
        <p className="text-gray-300 mb-8">
          Bem-vindo ao AssistentePro{userEmail ? ` (${userEmail})` : ''}
        </p>

        {loading ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center text-gray-400">
            Carregando dashboard...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Receitas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">
                    {formatCurrencyBRL(currentMonthSummary.income)}
                  </div>
                  <div className="text-sm text-gray-400">Mês atual</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Despesas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {formatCurrencyBRL(currentMonthSummary.expense)}
                  </div>
                  <div className="text-sm text-gray-400">Mês atual</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Saldo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">
                    {formatCurrencyBRL(currentMonthSummary.balance)}
                  </div>
                  <div className="text-sm text-gray-400">Receitas - Despesas</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              <Card>
                <CardHeader>
                  <CardTitle>Contas da semana</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 mb-4">
                    Vencimentos de {new Date(weekStart).toLocaleDateString('pt-BR')} até{' '}
                    {new Date(weekEnd).toLocaleDateString('pt-BR')}
                  </p>

                  {weekPayables.length === 0 ? (
                    <div className="text-gray-500 py-8 text-center">
                      Nenhuma conta pendente para os próximos 7 dias.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {weekPayables.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-4 border border-gray-800 rounded-lg px-4 py-3 bg-gray-950"
                        >
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">
                              {b.supplier_name || 'Conta'}
                            </div>
                            <div className="text-xs text-gray-400">
                              Vence em:{' '}
                              {b.due_date ? new Date(b.due_date).toLocaleDateString('pt-BR') : '-'}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-white font-semibold">
                              {formatCurrencyBRL(Number(b.amount || 0))}
                            </div>
                            <div className="text-xs text-amber-400">pendente</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button asChild variant="secondary">
                      <Link href="/bills">Ver todas</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Compromissos da semana</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400 mb-4">
                    Pendentes de {new Date(weekStart).toLocaleDateString('pt-BR')} até{' '}
                    {new Date(weekEnd).toLocaleDateString('pt-BR')}
                  </p>

                  {weekReminders.length === 0 ? (
                    <div className="text-gray-500 py-8 text-center">
                      Nenhum compromisso pendente para os próximos 7 dias.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {weekReminders.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-4 border border-gray-800 rounded-lg px-4 py-3 bg-gray-950"
                        >
                          <div className="min-w-0">
                            <div className="text-white font-medium truncate">{r.title}</div>
                            <div className="text-xs text-gray-400">
                              {r.due_date ? new Date(r.due_date).toLocaleDateString('pt-BR') : '-'}
                              {r.due_time ? ` • ${r.due_time}` : ''}
                              {r.reminder_type ? ` • ${r.reminder_type}` : ''}
                            </div>
                            {r.description ? (
                              <div className="text-xs text-gray-500 truncate mt-1">
                                {r.description}
                              </div>
                            ) : null}
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-amber-400">pendente</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button asChild variant="secondary">
                      <Link href="/reminders">Ver todos</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <section className="mb-10">
              <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <span role="img" aria-label="clock">
                  🕒
                </span>
                Transações Recentes
              </h2>
              <p className="text-gray-400 mb-4">Últimas 10 transações registradas</p>

              <div className="bg-gray-900 rounded-lg p-4 max-w-full overflow-x-auto">
                {transactions.length === 0 ? (
                  <div className="text-gray-500 text-center py-10">
                    Nenhuma transação registrada ainda.
                    <br />
                    Clique em &quot;Nova Transação&quot; para começar.
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="py-2 text-left">Data</th>
                        <th className="py-2 text-left">Descrição</th>
                        <th className="py-2 text-left">Categoria</th>
                        <th className="py-2 text-left">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-gray-800 last:border-b-0">
                          <td className="py-2">
                            {new Date(tx.date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-2">{tx.description || '-'}</td>
                          <td className="py-2">{tx.category || '-'}</td>
                          <td
                            className="py-2 font-semibold"
                            style={{
                              color: tx.type === 'income' ? '#22c55e' : '#fb7185',
                            }}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatCurrencyBRL(Math.abs(Number(tx.amount)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <Button
              asChild
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 mt-4"
            >
              <Link href="/transactions">Nova Transação</Link>
            </Button>
          </>
        )}
      </main>
    </div>
  )
}
