'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    whatsapp: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validações
      if (!formData.name || !formData.email || !formData.password) {
        setError('Preencha todos os campos obrigatórios')
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setError('As senhas não conferem')
        return
      }

      if (formData.password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres')
        return
      }

      if (!supabase) {
        setError('Supabase não configurado')
        return
      }

      // Criar usuário (sem hash por enquanto - apenas para desenvolvimento)
      // Em produção, fazer hash no backend com bcrypt
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          name: formData.name,
          email: formData.email,
          password_hash: formData.password, // Salvar senha simples por enquanto
          whatsapp_number: formData.whatsapp || null,
        }])
        .select()
        .single()

      if (createError) {
        if (createError.message.includes('duplicate')) {
          setError('Este email já está cadastrado')
        } else {
          setError(createError.message)
        }
        return
      }

      // Criar categorias padrão para o usuário
      const defaultCategories = [
        { name: 'Salário', type: 'income', user_id: newUser.id },
        { name: 'Vendas', type: 'income', user_id: newUser.id },
        { name: 'Outros Rendimentos', type: 'income', user_id: newUser.id },
        { name: 'Alimentação', type: 'expense', user_id: newUser.id },
        { name: 'Aluguel', type: 'expense', user_id: newUser.id },
        { name: 'Internet', type: 'expense', user_id: newUser.id },
        { name: 'Transporte', type: 'expense', user_id: newUser.id },
        { name: 'Saúde', type: 'expense', user_id: newUser.id },
        { name: 'Educação', type: 'expense', user_id: newUser.id },
        { name: 'Impostos', type: 'expense', user_id: newUser.id },
      ]

      await supabase
        .from('categories')
        .insert(defaultCategories)

      // Fazer login automático
      localStorage.setItem('user_id', newUser.id)
      localStorage.setItem('user_email', newUser.email)

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Criar Conta</CardTitle>
          <CardDescription>Cadastre-se para usar o assistente financeiro</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
              <Input
                id="whatsapp"
                placeholder="+55 11 99999-9999"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </Button>

            <div className="text-center text-sm">
              Já tem conta?{' '}
              <a href="/login" className="text-indigo-600 hover:underline">
                Fazer login
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
