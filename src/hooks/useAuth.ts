'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type UseAuthReturn = {
  user: User | null
  session: Session | null
  userId: string | null
  userEmail: string | null
  loading: boolean
  loginWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    if (!supabase) {
      setUser(null)
      setSession(null)
      setLoading(false)
      return
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.error('Erro ao obter sessão:', error)
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }

      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!active) return
      setSession(sess)
      setUser(sess?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      sub?.subscription.unsubscribe()
    }
  }, [])

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase não configurado')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase não configurado')

    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    if (!supabase) throw new Error('Supabase não configurado')

    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  return {
    user,
    session,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    loading,
    loginWithEmail,
    signUpWithEmail,
    logout,
  }
}

export { useAuth }
export default useAuth
