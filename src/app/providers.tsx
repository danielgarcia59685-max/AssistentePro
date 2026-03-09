'use client'

import React from 'react'
import { TransactionsProvider } from '../context/TransactionsContext' // pode ser este ou '@/...'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <TransactionsProvider>{children}</TransactionsProvider>
}
