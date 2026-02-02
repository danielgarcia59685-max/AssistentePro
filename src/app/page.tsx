'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      if (!supabase) {
        const userId = localStorage.getItem('user_id')
        router.push(userId ? '/dashboard' : '/login')
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }

    redirect()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecionando...</p>
      </div>
    </div>
  )
}