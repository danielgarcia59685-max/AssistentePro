import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Verifica se as credenciais do Supabase estão configuradas
const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_url_here' &&
  supabaseAnonKey !== 'your_supabase_anon_key_here' &&
  supabaseUrl.startsWith('http')

// Cria o cliente Supabase apenas se as credenciais estiverem configuradas
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Helper para verificar se o Supabase está disponível
export const isSupabaseAvailable = () => supabase !== null

// src/lib/supabase.ts
export async function fetchTransactions() {
  // Aqui você pode colocar um exemplo de retorno para não quebrar o app
  return []
}
