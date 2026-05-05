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

export async function signUpWithEmailPassword(
  config: InkwellSupabasePublicConfig,
  email: string,
  password: string,
  emailRedirectTo: string,
): Promise<{ ok: true; needsEmailConfirmation: boolean } | { ok: false; error: string }> {
  const supabase = getInkwellSupabaseClient(config)
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo },
  })
  if (error) return { ok: false, error: error.message }
  const needsEmailConfirmation = data.session == null
  return { ok: true, needsEmailConfirmation }
}

export async function requestPasswordResetEmail(
  config: InkwellSupabasePublicConfig,
  email: string,
  redirectTo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getInkwellSupabaseClient(config)
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function updatePassword(
  config: InkwellSupabasePublicConfig,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getInkwellSupabaseClient(config)
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOutInkwellCloud(config: InkwellSupabasePublicConfig): Promise<void> {
  const supabase = getInkwellSupabaseClient(config)
  await supabase.auth.signOut()
  resetInkwellSupabaseClient()
}

/** After Supabase consumes the URL (PKCE `code` or implicit hash), drop auth params so the hash router can own the URL. */
export function stripSupabaseAuthParamsFromBrowserUrl(nextHash?: string): void {
  if (typeof window === 'undefined') return
  const u = new URL(window.location.href)
  u.hash = ''
  const sp = new URLSearchParams(u.search)
  if (sp.has('code')) {
    sp.delete('code')
    sp.delete('type')
  }
  u.search = sp.toString() ? `?${sp.toString()}` : ''
  const tail = nextHash != null ? (nextHash.startsWith('#') ? nextHash : `#${nextHash}`) : ''
  window.history.replaceState(null, '', `${u.pathname}${u.search}${tail}`)
}
