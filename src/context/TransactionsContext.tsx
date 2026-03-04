'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth';

export interface Transaction {
  id: string
  user_id: string
  amount: number
  description: string | null
  type: 'income' | 'expense'
  category: string
  date: string
  created_at: string
}

interface TransactionsContextType {
  transactions: Transaction[]
  isLoading: boolean
  isConfigured: boolean
  addTransaction: (transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  refreshTransactions: () => Promise<void>
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined)

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)

  // Verifica se o Supabase está configurado
  useEffect(() => {
    setIsConfigured(!!supabase)
  }, [])

  const refreshTransactions = async () => {
    if (!supabase) return
    
    setIsLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setTransactions([])
        return
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', sessionData.session.user.id)
        .order('date', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) => {
    if (!supabase) return

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) throw new Error('Usuário não autenticado')

    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          ...transaction,
          user_id: sessionData.session.user.id,
        },
      ])
      .select()
      .single()

    if (error) throw error
    if (data) {
      setTransactions((prev) => [data, ...prev])
    }
  }

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!supabase) return

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (data) {
      setTransactions((prev) => prev.map((t) => (t.id === id ? data : t)))
    }
  }

  const deleteTransaction = async (id: string) => {
    if (!supabase) return

    const { error } = await supabase.from('transactions').delete().eq('id', id)

    if (error) throw error
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  // Carrega transações quando o contexto é montado
  useEffect(() => {
    if (isConfigured) {
      refreshTransactions()
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
