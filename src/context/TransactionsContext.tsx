"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category?: string;
  date: string;
  description?: string;
}

interface TransactionsContextProps {
  transactions: Transaction[];
  refreshTransactions: () => Promise<void>;
  addTransaction: (data: Omit<Transaction, 'id'>) => Promise<void>;
}

const TransactionsContext = createContext<TransactionsContextProps | undefined>(undefined);

export const TransactionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const refreshTransactions = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (!error && data) {
      setTransactions(data as Transaction[]);
    }
  };

  const addTransaction = async (data: Omit<Transaction, 'id'>) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('transactions')
      .insert([data]);
    if (!error) {
      await refreshTransactions();
    }
  };

  useEffect(() => {
    refreshTransactions();
  }, []);

  return (
    <TransactionsContext.Provider value={{ transactions, refreshTransactions, addTransaction }}>
      {children}
    </TransactionsContext.Provider>
  );
};

export const useTransactions = () => {
  const context = useContext(TransactionsContext);
  if (!context) throw new Error('useTransactions must be used within TransactionsProvider');
  return context;
};
