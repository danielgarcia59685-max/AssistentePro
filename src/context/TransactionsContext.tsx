'use client'

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

export interface Transaction {
  id: string
  user_id: string
  amount: number
  description: string | null
  type: 'income' | 'expense'
  category: string
  date: string
  created_at: string
  payment_method?: string | null
  currency?: string | null
}

type NewTransaction = Omit<Transaction, 'id' | 'user_id' | 'created_at'>

interface TransactionsContextType {
  transactions: Transaction[]
  isLoading: boolean
  isConfigured: boolean
  addTransaction: (transaction: NewTransaction) => Promise<void>
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  refreshTransactions: () => Promise<void>
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined)

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    setIsConfigured(Boolean(supabase))
  }, [])

  const refreshTransactions = async () => {
    if (!supabase) {
      setTransactions([])
      return
    }

    setIsLoading(true)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      if (!session) {
        setTransactions([])
        return
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })

      if (error) {
        throw error
      }

      setTransactions((data as Transaction[]) || [])
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }

  const addTransaction = async (transaction: NewTransaction) => {
    if (!supabase) {
      throw new Error('Supabase não configurado')
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    if (!session) {
      throw new Error('Usuário não autenticado')
    }

    const payload = {
      ...transaction,
      user_id: session.user.id,
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert([payload])
      .select()
      .single()

    if (error) {
      throw error
    }

    if (data) {
      setTransactions((prev) => [data as Transaction, ...prev])
    }
  }

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!supabase) {
      throw new Error('Supabase não configurado')
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    if (data) {
      setTransactions((prev) =>
        prev.map((transaction) => (transaction.id === id ? (data as Transaction) : transaction)),
      )
    }
  }

  const deleteTransaction = async (id: string) => {
    if (!supabase) {
      throw new Error('Supabase não configurado')
    }

    const { error } = await supabase.from('transactions').delete().eq('id', id)

    if (error) {
      throw error
    }

    setTransactions((prev) => prev.filter((transaction) => transaction.id !== id))
  }

  useEffect(() => {
    if (isConfigured) {
      void refreshTransactions()
    }
  }, [isConfigured])

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        isLoading,
        isConfigured,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        refreshTransactions,
      }}
    >
      {children}
    </TransactionsContext.Provider>
  )
}

export function useTransactions() {
  const context = useContext(TransactionsContext)

  if (context === undefined) {
    throw new Error('useTransactions deve ser usado dentro de TransactionsProvider')
  }

  return context
}
