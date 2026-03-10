'use client'

import type { ReactNode } from 'react'
import { TransactionsProvider } from '@/context/TransactionsContext'

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return <TransactionsProvider>{children}</TransactionsProvider>
}
