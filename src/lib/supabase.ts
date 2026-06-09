import { createClient } from '@supabase/supabase-js'

// Vite replaces these at build time. If empty (local Capacitor build),
// fall back to public values that are already exposed in client-side JS.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://xulnxwwwjpvgsaqnsllo.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_PHuC0kENMdy-Qdfd3iAKnQ_AKpnpwo4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
