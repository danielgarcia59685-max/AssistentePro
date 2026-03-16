'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showResend, setShowResend] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setShowResend(false)
    setLoading(true)

    try {
      if (!supabase) {
        setError('Supabase não configurado')
        return
      }

      const normalizedEmail = email.trim().toLowerCase()

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
        return
      }

      const userId = signInData.user.id
      const fallbackName = normalizedEmail.split('@')[0] || 'Usuário'

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, email, name, timezone, currency')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        throw profileError
      }

      if (!profile) {
        const { error: insertError } = await supabase.from('users').insert([
          {
            id: userId,
            email: normalizedEmail,
            name: '',
            timezone: 'America/Sao_Paulo',
            currency: 'BRL',
          },
        ])

        if (insertError) {
          const { error: fallbackInsertError } = await supabase.from('users').upsert([
            {
              id: userId,
              email: normalizedEmail,
              name: fallbackName,
              timezone: 'America/Sao_Paulo',
              currency: 'BRL',
            },
          ])

          if (fallbackInsertError) throw fallbackInsertError

          localStorage.setItem('user_id', userId)
          localStorage.setItem('user_email', normalizedEmail)
          localStorage.setItem('onboarding_complete', '1')
          router.push('/dashboard')
          return
        }

        localStorage.setItem('user_id', userId)
        localStorage.setItem('user_email', normalizedEmail)
        localStorage.removeItem('onboarding_complete')
        router.push('/onboarding')
        return
      }

      localStorage.setItem('user_id', userId)
      localStorage.setItem('user_email', normalizedEmail)

      const hasCompletedProfile = !!profile.name?.trim()

      if (hasCompletedProfile) {
        localStorage.setItem('onboarding_complete', '1')
        router.push('/dashboard')
      } else {
        localStorage.removeItem('onboarding_complete')
        router.push('/onboarding')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
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

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
    })

    if (resendError) {
      setError(`Erro ao reenviar confirmação: ${resendError.message}`)
      return
    }

    setInfo('Email de confirmação reenviado. Verifique sua caixa de entrada.')
  }

  return (
    <div className="bg-app relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-[-100px] top-[-60px] h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-[-80px] left-[-80px] h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="premium-panel p-8 sm:p-10">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 shadow-lg shadow-purple-500/10">
              <Image
                src="/logo.png"
                alt="AssistentePro"
                width={38}
                height={38}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>

            <div className="premium-chip mb-4">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Acesse sua conta
            </div>

            <h1 className="text-center text-3xl font-bold text-white">AssistentePro</h1>
            <p className="mt-2 text-center text-sm text-slate-400">premium fintech dark</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error ? (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            ) : null}

            {info ? (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <p className="text-sm text-emerald-300">{info}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-2xl border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-2xl border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl border-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 text-white hover:opacity-95"
            >
              {loading ? 'Entrando...' : 'Entrar'}
              {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
            </Button>

            {showResend ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleResendConfirmation}
                className="h-12 w-full rounded-2xl border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10"
              >
                Reenviar confirmação de email
              </Button>
            ) : null}

            <div className="border-t border-white/10 pt-4 text-center">
              <p className="text-sm text-slate-400">
                Não tem conta?{' '}
                <Link href="/register" className="font-semibold text-blue-400 hover:text-blue-300">
                  Registre-se
                </Link>
              </p>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          © 2026 AssistentePro. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
