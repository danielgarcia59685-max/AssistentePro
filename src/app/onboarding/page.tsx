'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      if (!supabase) {
        setError('Supabase não configurado')
        setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!data.session?.user) {
        router.push('/login')
        return
      }

      const userId = data.session.user.id

      const { data: profile } = await supabase
        .from('users')
        .select('name, timezone, currency')
        .eq('id', userId)
        .single()

      if (profile) {
        setFormData({
          name: profile.name || '',
          timezone: profile.timezone || 'America/Sao_Paulo',
          currency: profile.currency || 'BRL',
        })
      }

      setLoading(false)
    }

    init()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!supabase) {
      setError('Supabase não configurado')
      return
    }

    if (!formData.name.trim()) {
      setError('Informe seu nome')
      return
    }

    setSaving(true)

    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session?.user) {
        router.push('/login')
        return
      }

      const userId = data.session.user.id

      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: formData.name.trim(),
          timezone: formData.timezone,
          currency: formData.currency,
        })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      localStorage.setItem('onboarding_complete', '1')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-app flex min-h-screen items-center justify-center">
        <div className="premium-panel px-8 py-6 text-slate-300">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="bg-app flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg premium-panel p-8 sm:p-10">
        <div className="mb-6">
          <div className="premium-chip mb-4">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Primeiro acesso
          </div>

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-300">
            <UserCircle2 className="h-8 w-8" />
          </div>

          <h1 className="text-3xl font-bold text-white">Vamos configurar seu perfil</h1>
          <p className="mt-2 text-sm text-slate-400">
            Isso leva menos de 1 minuto e ajuda a personalizar sua experiência.
          </p>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-slate-300">Seu nome</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Daniel"
              className="h-12 rounded-2xl border-white/10 bg-slate-950/50 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Fuso horário</Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
            >
              <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                <SelectItem value="America/Sao_Paulo">Brasil (São Paulo)</SelectItem>
                <SelectItem value="America/New_York">EUA (Nova York)</SelectItem>
                <SelectItem value="Europe/Lisbon">Portugal (Lisboa)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Moeda</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => setFormData({ ...formData, currency: value })}
            >
              <SelectTrigger className="h-12 rounded-2xl border-white/10 bg-slate-950/50 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                <SelectItem value="BRL">BRL — Real</SelectItem>
                <SelectItem value="USD">USD — Dólar</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-2xl border-0 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 text-white hover:opacity-95"
          >
            {saving ? 'Salvando...' : 'Concluir'}
          </Button>
        </form>
      </div>
    </div>
  )
}
