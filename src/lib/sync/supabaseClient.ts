import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createInkwellAuthStorage } from './inkwellAuthStorage'
import type { InkwellSupabasePublicConfig } from './syncEnv'

let cached: SupabaseClient | null = null
let cachedKey = ''

export function getInkwellSupabaseClient(config: InkwellSupabasePublicConfig): SupabaseClient {
  const key = `${config.url}\0${config.anonKey}`
  if (cached && cachedKey === key) return cached
  cachedKey = key
  cached = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: createInkwellAuthStorage(),
      flowType: 'pkce',
    },
  })
  return cached
}

export function resetInkwellSupabaseClient(): void {
  cached = null
  cachedKey = ''
}
