'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL'
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
          currency: profile.currency || 'BRL'
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
      const { error, data: updateData } = await supabase
        .from('users')
        .update({
          name: formData.name.trim(),
          timezone: formData.timezone,
          currency: formData.currency
        })
        .eq('id', userId)

      if (error) {
        console.error('Erro Supabase update:', error)
        setError(error.message || 'Erro ao salvar')
        return
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-3xl border border-gray-800 p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Vamos configurar seu perfil</h1>
        <p className="text-gray-400 mb-6">Isso leva menos de 1 minuto.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-gray-300">Seu nome</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Daniel"
              className="bg-gray-800 border-gray-700 text-white rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Fuso horário</Label>
            <Select value={formData.timezone} onValueChange={(value) => setFormData({ ...formData, timezone: value })}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="America/Sao_Paulo">Brasil (São Paulo)</SelectItem>
                <SelectItem value="America/New_York">EUA (Nova York)</SelectItem>
                <SelectItem value="Europe/Lisbon">Portugal (Lisboa)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Moeda</Label>
            <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="BRL">BRL — Real</SelectItem>
                <SelectItem value="USD">USD — Dólar</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl"
          >
            {saving ? 'Salvando...' : 'Concluir'}
          </Button>
        </form>
      </div>
    </div>
  )
}
