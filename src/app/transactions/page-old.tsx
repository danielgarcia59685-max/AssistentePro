'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  category: string
  description: string
  date: string
  payment_method: string
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    if (!supabase) {
      console.warn('Supabase não está configurado')
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

      if (error) {
        console.error('Erro ao buscar transações:', error)
      } else {
        setTransactions(data || [])
      }
    } catch (error) {
      console.error('Erro ao buscar transações:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    try {
      await supabase.from('transactions').delete().eq('id', id)
      fetchTransactions()
    } catch (err) {
      console.error('Erro ao deletar transação:', err)
    }
  }

  const handleEdit = async (t: Transaction) => {
    if (!supabase) return
    try {
      const newAmountStr = prompt('Novo valor (use ponto para decimais)', t.amount.toString())
      if (!newAmountStr) return
      const newAmount = parseFloat(newAmountStr)
      if (isNaN(newAmount)) return alert('Valor inválido')
      const newDesc = prompt('Nova descrição', t.description) || t.description
      await supabase.from('transactions').update({ amount: newAmount, description: newDesc }).eq('id', t.id)
      fetchTransactions()
    } catch (err) {
      console.error('Erro ao editar transação:', err)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Transações</h1>
        <Button>Nova Transação</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell>{transaction.payment_method}</TableCell>
                  <TableCell className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                    {transaction.type === 'income' ? '+' : '-'}R$ {transaction.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(transaction)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(transaction.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}