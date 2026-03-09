export type TxType = 'income' | 'expense'

export type DateRange = { start: string | null; end: string | null }

export type TransactionRow = {
  id: string
  quantidade: number | string | null
  tipo: TxType
  categoria: string | null
  description: string | null
  data: string
}

export interface MonthlyData {
  key: string
  label: string
  income: number
  expense: number
  balance: number
}

export interface CategoryData {
  name: string
  value: number
  percent?: number
}

// Adicione esta função:
export const formatCurrencyBRL = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
