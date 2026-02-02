'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (password !== confirmPassword) {
        setError('As senhas não coincidem')
        setLoading(false)
        return
      }

      if (!supabase) {
        setError('Supabase não configurado')
        setLoading(false)
        return
      }

      // Registrar via Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      })

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError('Este email já está cadastrado')
        } else {
          setError('Erro ao registrar: ' + signUpError.message)
        }
        setLoading(false)
        return
      }

      // Se usuário criado, garantir perfil na tabela `users`
      const userId = signUpData?.user?.id
      if (userId) {
        const fallbackName = normalizedEmail.split('@')[0] || 'Usuário'
        await supabase.from('users').upsert([{ id: userId, email: normalizedEmail, name: fallbackName }])
      }

      setSuccess('Conta criada com sucesso! Verifique seu email se necessário. Redirecionando...')
      setTimeout(() => {
        router.push('/login')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-amber-600/5 blur-3xl rounded-full"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-amber-600/5 blur-3xl rounded-full"></div>
      </div>

      {/* Register Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-amber-600/20">
              <img src="/logo-assistentepro.svg" alt="AssistentePro" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white text-center mb-2">AssistentePro</h1>
          <p className="text-gray-400 text-center mb-8">Crie sua conta</p>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-3">
              <Label htmlFor="email" className="text-gray-300 font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:ring-amber-600/50 focus:border-amber-600"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-3">
              <Label htmlFor="password" className="text-gray-300 font-medium">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:ring-amber-600/50 focus:border-amber-600"
              />
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-3">
              <Label htmlFor="confirmPassword" className="text-gray-300 font-medium">Confirme a Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:ring-amber-600/50 focus:border-amber-600"
              />
            </div>

            {/* Register Button */}
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-8"
            >
              {loading ? 'Criando conta...' : 'Registrar'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>

            {/* Login Link */}
            <div className="text-center pt-4 border-t border-gray-800">
              <p className="text-gray-400 text-sm">
                Já tem conta?{' '}
                <a href="/login" className="text-amber-600 hover:text-amber-500 font-semibold transition-colors">
                  Faça login
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-8">
          © 2026 AssistentePro. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
