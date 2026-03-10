import { TransactionsProvider } from '@/context/TransactionsContext'

export default function AnalyticsPage() {
  return (
    <TransactionsProvider>
      <main className="p-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-2 text-sm text-gray-600">
          Página de análises financeiras em preparação.
        </p>
      </main>
    </TransactionsProvider>
  )
}
