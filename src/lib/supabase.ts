import { createClient } from '@supabase/supabase-js'
import { createTimedFetch, parseRequestTimeout } from '@/lib/timed-fetch'
import { isConfigured } from '@/lib/utils'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const requestTimeoutMs = parseRequestTimeout(import.meta.env.VITE_REQUEST_TIMEOUT_MS)

export const isSupabaseConfigured = isConfigured(supabaseUrl) && isConfigured(supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: createTimedFetch(globalThis.fetch.bind(globalThis), requestTimeoutMs) },
    })
  : null
