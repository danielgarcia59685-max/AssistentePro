'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      try {
        if (!supabase) {
          const userId = localStorage.getItem('user_id')
          router.replace(userId ? '/dashboard' : '/login')
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const user = sessionData.session?.user

        if (!user) {
          router.replace('/login')
          return
        }

        const { data: profile } = await supabase
          .from('users')
          .select('name, timezone, currency')
          .eq('id', user.id)
          .maybeSingle()

        const onboardingComplete =
          Boolean(profile?.name) &&
          Boolean(profile?.timezone) &&
          Boolean(profile?.currency)

        if (onboardingComplete) {
          localStorage.setItem('onboarding_complete', '1')
          router.replace('/dashboard')
        } else {
          router.replace('/onboarding')
        }
      } catch (error) {
        console.error('Erro ao redirecionar página inicial:', error)
        router.replace('/login')
      }
    }

    redirect()
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto" />
        <p className="mt-4 text-gray-400">Redirecionando...</p>
      </div>
    </div>
  )
}
