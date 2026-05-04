import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { getInkwellSupabaseClient, resetInkwellSupabaseClient } from './supabaseClient'
import type { InkwellSupabasePublicConfig } from './syncEnv'

export type AuthSessionSnapshot = {
  session: Session | null
  user: User | null
}

export function subscribeAuthSession(
  config: InkwellSupabasePublicConfig,
  onChange: (snap: AuthSessionSnapshot, event: AuthChangeEvent) => void,
): () => void {
  const supabase = getInkwellSupabaseClient(config)
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    onChange({ session, user: session?.user ?? null }, event)
  })
  return () => {
    data.subscription.unsubscribe()
  }
}

export async function getSessionSnapshot(config: InkwellSupabasePublicConfig): Promise<AuthSessionSnapshot> {
  const supabase = getInkwellSupabaseClient(config)
  const { data } = await supabase.auth.getSession()
  const session = data.session ?? null
  return { session, user: session?.user ?? null }
}

export async function signInWithEmailPassword(
  config: InkwellSupabasePublicConfig,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getInkwellSupabaseClient(config)
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOutInkwellCloud(config: InkwellSupabasePublicConfig): Promise<void> {
  const supabase = getInkwellSupabaseClient(config)
  await supabase.auth.signOut()
  resetInkwellSupabaseClient()
}
