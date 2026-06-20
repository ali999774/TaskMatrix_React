import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required — check your .env file')
}

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required — check your .env file')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
