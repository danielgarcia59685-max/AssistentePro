'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showResend, setShowResend] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setShowResend(false)

    if (!supabase) {
      setError('Supabase não configurado')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Informe um email válido')
      return
    }

    if (!password) {
      setError('Informe sua senha')
      return
    }

    setLoading(true)

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signInError || !signInData?.user) {
        const message = signInError?.message?.toLowerCase() || ''

        if (message.includes('confirm') || message.includes('not confirmed')) {
          setError(
            'Seu email ainda não foi confirmado. Verifique sua caixa de entrada ou reenvie a confirmação.',
          )
          setShowResend(true)
        } else {
          setError('Email ou senha incorretos')
        }

        localStorage.removeItem('user_id')
        localStorage.removeItem('user_email')
        return
      }

      const user = signInData.user
      const userId = user.id
      const fallbackName = normalizedEmail.split('@')[0] || 'Usuário'

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, email, name, timezone, currency')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError)
      }

      if (!profile) {
        await supabase
          .from('users')
          .upsert([
            {
              id: userId,
              email: normalizedEmail,
              name: fallbackName,
              updated_at: new Date().toISOString(),
            },
          ])
          .throwOnError()
      }

      localStorage.setItem('user_id', userId)
      localStorage.setItem('user_email', normalizedEmail)

      const needsOnboarding =
        !profile?.name || !profile?.timezone || !profile?.currency || !localStorage.getItem('onboarding_complete')

      router.push(needsOnboarding ? '/onboarding' : '/dashboard')
    } catch (err: any) {
      console.error('Erro ao fazer login:', err)
      setError(err?.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    setError('')
    setInfo('')

    if (!supabase) {
      setError('Supabase não configurado')
      return
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Informe o email para reenviar a confirmação')
      return
    }

    setResending(true)

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
      })

      if (resendError) {
        setError(`Erro ao reenviar confirmação: ${resendError.message}`)
        return
      }

      setInfo('Email de confirmação reenviado. Verifique sua caixa de entrada.')
    } catch (err: any) {
      console.error('Erro ao reenviar confirmação:', err)
      setError(err?.message || 'Erro ao reenviar confirmação')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-amber-600/5 blur-3xl rounded-full" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-amber-600/5 blur-3xl rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-8 shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-amber-600/20 relative">
              <Image
                src="/assets/mark-assistentepro.svg"
                alt="AssistentePro"
                fill
                className="object-cover"
              />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-2">AssistentePro</h1>
          <p className="text-gray-400 text-center mb-8">assistente pessoal</p>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {info && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-green-400 text-sm">{info}</p>
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="email" className="text-gray-300 font-medium">
                Email
              </Label>
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

            <div className="space-y-3">
              <Label htmlFor="password" className="text-gray-300 font-medium">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-gray-800 border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:ring-amber-600/50 focus:border-amber-600"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-8"
            >
              {loading ? 'Entrando...' : 'Entrar'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>

            {showResend && (
              <Button
                type="button"
                variant="outline"
                disabled={resending}
                onClick={handleResendConfirmation}
                className="w-full border-amber-600 text-amber-400 hover:text-amber-300 hover:bg-amber-600/10"
              >
                {resending ? 'Reenviando...' : 'Reenviar confirmação de email'}
              </Button>
            )}

            <div className="text-center pt-4 border-t border-gray-800">
              <p className="text-gray-400 text-sm">
                Não tem conta?{' '}
                <Link
                  href="/register"
                  className="text-amber-600 hover:text-amber-500 font-semibold transition-colors"
                >
                  Registre-se
                </Link>
              </p>
            </div>
          </form>
        </div>

        <p className="text-center text-gray-500 text-xs mt-8">
          © 2026 AssistentePro. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
