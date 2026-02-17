'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Transaction } from '../types/transaction'
import { useAuth } from '../hooks/use-auth'

type TransactionsContextValue = {
  transactions: Transaction[]
  refreshTransactions: () => Promise<void>
  addTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>
}

const TransactionsContext = createContext<TransactionsContextValue | null>(null)

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth() as { userId: string | null }

  const [transactions, setTransactions] = useState<Transaction[]>([])

  const refreshTransactions = async () => {
    if (!supabase || !userId) {
      setTransactions([])
      return
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('id, type, amount, category, date, description')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Erro ao buscar transações:', error)
      setTransactions([])
      return
    }

    setTransactions((data ?? []) as Transaction[])
  }

  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    if (!supabase || !userId) throw new Error('Supabase não configurado ou usuário não autenticado')

    const { error } = await supabase.from('transactions').insert([
      {
        user_id: userId,
        type: t.type,
        amount: t.amount,
        category: t.category ?? null,
        description: t.description ?? null,
        date: t.date,
      },
    ])

    if (error) throw error

    await refreshTransactions()
  }

  useEffect(() => {
    refreshTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const value = useMemo(
    () => ({
      transactions,
      refreshTransactions,
      addTransaction,
    }),
    [transactions]
  )

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>
}

export function useTransactions() {
  const ctx = useContext(TransactionsContext)
  if (!ctx) throw new Error('useTransactions deve ser usado dentro de <TransactionsProvider>')
  return ctx
}
