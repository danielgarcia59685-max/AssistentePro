'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Navigation } from '@/components/Navigation'
import { Plus, Trash2, TrendingUp, Target } from 'lucide-react'

interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string
  category: string
  description: string
}

export default function GoalsPage() {
  const { userId, userEmail, logout, loading: authLoading } = useAuth()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    deadline: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
    category: 'savings',
    description: '',
  })

  useEffect(() => {
    if (!authLoading && userId) {
      fetchGoals()
    }
  }, [authLoading, userId])

  const fetchGoals = async () => {
    if (!supabase || !userId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('financial_goals')
        .select('*')
        .eq('user_id', userId)
        .order('deadline', { ascending: true })

      if (error) {
        console.error('Erro ao carregar metas:', error)
      } else {
        setGoals(data || [])
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!supabase || !userId) return

    try {
      await supabase
        .from('financial_goals')
        .insert([{
          user_id: userId,
          name: formData.name,
          target_amount: parseFloat(formData.target_amount),
          deadline: formData.deadline,
          category: formData.category,
          description: formData.description,
          current_amount: 0,
        }])

      setFormData({
        name: '',
        target_amount: '',
        deadline: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0],
        category: 'savings',
        description: '',
      })
      setShowAddForm(false)
      fetchGoals()
    } catch (error) {
      console.error('Erro ao adicionar meta:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return

    try {
      await supabase
        .from('financial_goals')
        .delete()
        .eq('id', id)

      fetchGoals()
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const handleUpdateProgress = async (id: string, newAmount: number) => {
    if (!supabase) return

    try {
      await supabase
        .from('financial_goals')
        .update({ current_amount: newAmount })
        .eq('id', id)

      fetchGoals()
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'savings':
        return '💰 Poupança'
      case 'investment':
        return '📈 Investimento'
      case 'debt_payment':
        return '💳 Pagar Dívida'
      case 'purchase':
        return '🛒 Compra'
      default:
        return '🎯 Objetivo'
    }
  }

  const getProgressPercentage = (current: number, target: number) => {
    return target > 0 ? Math.min((current / target) * 100, 100) : 0
  }

  const isOverdue = (deadline: string) => {
    return new Date(deadline) < new Date()
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">🎯 Metas Financeiras</h1>
              <p className="text-gray-600 mt-1">Planeje e acompanhe seus objetivos</p>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Meta
            </Button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <Card className="bg-white shadow-lg">
              <CardHeader>
                <CardTitle>Criar Nova Meta Financeira</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddGoal} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome da Meta</Label>
                      <Input
                        id="name"
                        placeholder="Ex: Férias no exterior"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="target_amount">Valor Alvo</Label>
                      <Input
                        id="target_amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.target_amount}
                        onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="savings">💰 Poupança</SelectItem>
                          <SelectItem value="investment">📈 Investimento</SelectItem>
                          <SelectItem value="debt_payment">💳 Pagar Dívida</SelectItem>
                          <SelectItem value="purchase">🛒 Compra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deadline">Data Limite</Label>
                      <Input
                        id="deadline"
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      placeholder="Detalhes sobre sua meta"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                      Criar Meta
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Goals Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {goals.length === 0 ? (
              <Card className="bg-white shadow-lg col-span-full">
                <CardContent className="text-center py-12 text-gray-500">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Nenhuma meta criada ainda</p>
                  <p className="text-sm mt-2">Clique em "Nova Meta" para começar</p>
                </CardContent>
              </Card>
            ) : (
              goals.map((goal) => {
                const progress = getProgressPercentage(goal.current_amount, goal.target_amount)
                const isOver = isOverdue(goal.deadline)

                return (
                  <Card key={goal.id} className={`bg-white shadow-lg hover:shadow-xl transition-shadow ${isOver ? 'border-2 border-red-300' : ''}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{goal.name}</CardTitle>
                          <CardDescription className="mt-1">{getCategoryLabel(goal.category)}</CardDescription>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleDelete(goal.id)}
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-semibold">
                            R$ {goal.current_amount.toFixed(2)} / R$ {goal.target_amount.toFixed(2)}
                          </span>
                          <span className="text-gray-600">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-green-400 to-green-600 h-full rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Description */}
                      {goal.description && (
                        <p className="text-sm text-gray-600">{goal.description}</p>
                      )}

                      {/* Deadline */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className={isOver ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {isOver ? '⚠️ Vencida' : '📅'} {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {/* Add Progress Button */}
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Adicionar valor"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const value = parseFloat((e.target as HTMLInputElement).value)
                              if (!isNaN(value) && value > 0) {
                                handleUpdateProgress(goal.id, goal.current_amount + value)
                                ;(e.target as HTMLInputElement).value = ''
                              }
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={(e) => {
                            const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)
                            if (input) {
                              const value = parseFloat(input.value)
                              if (!isNaN(value) && value > 0) {
                                handleUpdateProgress(goal.id, goal.current_amount + value)
                                input.value = ''
                              }
                            }
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {/* Summary Cards */}
          {goals.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total de Metas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">R$ {goals.reduce((sum, g) => sum + g.target_amount, 0).toFixed(2)}</div>
                  <p className="text-xs text-blue-100 mt-1">{goals.length} objetivo(s)</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Progresso Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Math.round(
                      (goals.reduce((sum, g) => sum + g.current_amount, 0) /
                        goals.reduce((sum, g) => sum + g.target_amount, 0)) *
                        100
                    )}
                    %
                  </div>
                  <p className="text-xs text-green-100 mt-1">
                    R$ {goals.reduce((sum, g) => sum + g.current_amount, 0).toFixed(2)} acumulado
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
