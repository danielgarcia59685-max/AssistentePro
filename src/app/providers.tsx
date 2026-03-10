'use client'

import type { ReactNode } from 'react'
import { TransactionsProvider } from '@/context/TransactionsContext'

export default function Providers({ children }: { children: ReactNode }) {
  return <TransactionsProvider>{children}</TransactionsProvider>
}
