import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function init() {
      if (!supabase) {
        // If supabase not available, fallback to localStorage
        const storedUserId = localStorage.getItem('user_id')
        const storedEmail = localStorage.getItem('user_email')
        if (storedUserId && storedEmail) {
          setUserId(storedUserId)
          setUserEmail(storedEmail)
        } else {
          router.push('/login')
        }
        setLoading(false)
        return
      }

      try {
        const { data } = await supabase.auth.getSession()
        const session = data.session
        if (session && mounted) {
          setUserId(session.user.id)
          setUserEmail(session.user.email || null)
        } else if (mounted) {
          // redirect to login if no session
          router.push('/login')
        }

        // Subscribe to auth state changes
        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            setUserId(session.user.id)
            setUserEmail(session.user.email || null)
          } else {
            setUserId(null)
            setUserEmail(null)
            router.push('/login')
          }
        })

        setLoading(false)

        return () => {
          mounted = false
          listener?.subscription.unsubscribe()
        }
      } catch (err) {
        console.warn('Erro ao inicializar auth:', err)
        setLoading(false)
        router.push('/login')
      }
    }

    init()
  }, [router])

  const logout = async () => {
    try {
      if (supabase) await supabase.auth.signOut()
    } catch (err) {
      console.warn('Erro ao deslogar do Supabase:', err)
    }
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_email')
    router.push('/login')
  }

  return { userId, userEmail, loading, logout }
}
