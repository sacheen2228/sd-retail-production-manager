import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const USE_SUPABASE = Boolean(url && anonKey)

/**
 * Mutable holder so the backend can be swapped in tests.
 * In production `supabase` is created once and never changes.
 */
export const supabaseClient = {
  USE_SUPABASE,
  supabase: USE_SUPABASE
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null
}
