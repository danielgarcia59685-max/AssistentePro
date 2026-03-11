'use client'

import { useEffect, useMemo, useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrencyBRL } from '@/lib/format'
import { Search, Wallet, ArrowUpRight, ArrowDownRight, CalendarClock, Receipt } from 'lucide-react'

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
  const [reminderSearch, setReminderSearch] = useState('')
  const [payableSearch, setPayableSearch] = useState('')

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

      if (!txError && txData) {
        setTransactions(
          (txData as Transaction[]).map((tx) => ({
            ...tx,
            date: normalizeDateOnly(tx.date),
          })),
        )
      }

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
        .limit(20)

      if (!remError && remData) {
        setWeekReminders(
          (remData as Reminder[]).map((r) => ({
            ...r,
            due_date: normalizeDateOnly(r.due_date),
          })),
        )
      } else {
        setWeekReminders([])
      }

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
        .limit(20)

      if (!apError && apData) {
        setWeekPayables(
          (apData as AccountPayable[]).map((b) => ({
            ...b,
            due_date: normalizeDateOnly(b.due_date),
            payment_date: normalizeDateOnly(b.payment_date),
          })),
        )
      } else {
        setWeekPayables([])
      }
    }

    fetchData()
  }, [authLoading, userId, weekStart, weekEnd])

  const visibleWeekReminders = useMemo(() => {
    if (!reminderSearch.trim()) return weekReminders
    const term = reminderSearch.trim().toLowerCase()

    return weekReminders.filter(
      (r) =>
        (r.title || '').toLowerCase().includes(term) ||
        (r.description || '').toLowerCase().includes(term) ||
        (r.reminder_type || '').toLowerCase().includes(term),
    )
  }, [weekReminders, reminderSearch])

  const visibleWeekPayables = useMemo(() => {
    if (!payableSearch.trim()) return weekPayables
    const term = payableSearch.trim().toLowerCase()

    return weekPayables.filter(
      (b) =>
        (b.supplier_name || '').toLowerCase().includes(term) ||
        (b.description || '').toLowerCase().includes(term),
    )
  }, [weekPayables, payableSearch])

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Página inicial</h1>
          <p className="text-gray-400">
            Bem-vindo ao AssistentePro{userEmail ? ` (${userEmail})` : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-white text-xl font-semibold">Receitas</p>
            </div>
            <div className="text-3xl font-bold text-green-500">
              {formatCurrencyBRL(currentMonthSummary.income)}
            </div>
            <div className="text-sm text-gray-400 mt-2">Mês atual</div>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-white text-xl font-semibold">Despesas</p>
            </div>
            <div className="text-3xl font-bold text-red-500">
              {formatCurrencyBRL(currentMonthSummary.expense)}
            </div>
            <div className="text-sm text-gray-400 mt-2">Mês atual</div>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-white text-xl font-semibold">Saldo</p>
            </div>
            <div className="text-3xl font-bold text-amber-500">
              {formatCurrencyBRL(currentMonthSummary.balance)}
            </div>
            <div className="text-sm text-gray-400 mt-2">Receitas - Despesas</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Receipt className="w-5 h-5 text-amber-500" />
              <h2 className="text-2xl font-bold text-white">Contas da semana</h2>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Vencimentos de {formatDateBR(weekStart)} até {formatDateBR(weekEnd)}
            </p>

            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar contas da semana"
                value={payableSearch}
                onChange={(e) => setPayableSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-3 outline-none"
              />
            </div>

            {visibleWeekPayables.length === 0 ? (
              <div className="text-gray-500 py-8 text-center border border-gray-800 rounded-xl bg-gray-950/40">
                Nenhuma conta pendente para os próximos 7 dias.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleWeekPayables.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-4 border border-gray-800 rounded-xl px-4 py-4 bg-gray-950/40"
                  >
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">
                        {b.supplier_name || 'Conta'}
                      </div>
                      {b.description ? (
                        <div className="text-sm text-gray-500 truncate mt-1">{b.description}</div>
                      ) : null}
                      <div className="text-xs text-gray-400 mt-1">
                        Vence em: {formatDateBR(b.due_date)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-white font-bold">
                        {formatCurrencyBRL(Number(b.amount || 0))}
                      </div>
                      <div className="text-xs text-amber-400">pendente</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button asChild variant="secondary" className="bg-gray-800 hover:bg-gray-700 text-white">
                <a href="/bills">Ver todas</a>
              </Button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <CalendarClock className="w-5 h-5 text-amber-500" />
              <h2 className="text-2xl font-bold text-white">Compromissos da semana</h2>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Pendentes de {formatDateBR(weekStart)} até {formatDateBR(weekEnd)}
            </p>

            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar compromissos da semana"
                value={reminderSearch}
                onChange={(e) => setReminderSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-3 outline-none"
              />
            </div>

            {visibleWeekReminders.length === 0 ? (
              <div className="text-gray-500 py-8 text-center border border-gray-800 rounded-xl bg-gray-950/40">
                Nenhum compromisso pendente para os próximos 7 dias.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleWeekReminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 border border-gray-800 rounded-xl px-4 py-4 bg-gray-950/40"
                  >
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{r.title}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDateBR(r.due_date)}
                        {r.due_time ? ` • ${r.due_time}` : ''}
                        {r.reminder_type ? ` • ${r.reminder_type}` : ''}
                      </div>
                      {r.description ? (
                        <div className="text-sm text-gray-500 truncate mt-1">{r.description}</div>
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
              <Button asChild variant="secondary" className="bg-gray-800 hover:bg-gray-700 text-white">
                <a href="/reminders">Ver todos</a>
              </Button>
            </div>
          </div>
        </div>

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-white">Transações recentes</h2>
          </div>

          <p className="text-gray-400 mb-4">Últimas 10 transações registradas</p>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="text-gray-500 text-center py-10 px-4">
                Nenhuma transação registrada ainda.
                <br />
                Clique em &quot;Nova Transação&quot; para começar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-800/50">
                    <tr className="text-gray-400">
                      <th className="py-4 px-4 text-left">Data</th>
                      <th className="py-4 px-4 text-left">Descrição</th>
                      <th className="py-4 px-4 text-left">Categoria</th>
                      <th className="py-4 px-4 text-left">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-t border-gray-800">
                        <td className="py-4 px-4 text-gray-300">{formatDateBR(tx.date)}</td>
                        <td className="py-4 px-4 text-white">{tx.description || '-'}</td>
                        <td className="py-4 px-4 text-gray-300">{tx.category || '-'}</td>
                        <td
                          className={`py-4 px-4 font-bold ${
                            tx.type === 'income' ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatCurrencyBRL(Math.abs(Number(tx.amount)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <Button
          asChild
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"
        >
          <a href="/transactions">Nova Transação</a>
        </Button>
      </main>
    </div>
  )
}
