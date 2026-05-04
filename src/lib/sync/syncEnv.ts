/**
 * Env-gated Supabase sync (see docs/CLOUD_SYNC.md). Off unless explicitly enabled.
 */
export type InkwellSupabasePublicConfig = {
  url: string
  anonKey: string
}

function truthyFlag(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function isInkwellCloudSyncFeatureEnabled(): boolean {
  return truthyFlag(import.meta.env.VITE_INKWELL_CLOUD_SYNC)
}

function readSupabasePublicKey(): string {
  const fromLegacy = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (fromLegacy) return fromLegacy
  return (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
}

export function getInkwellSupabasePublicConfig(): InkwellSupabasePublicConfig | null {
  if (!isInkwellCloudSyncFeatureEnabled()) return null
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = readSupabasePublicKey()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function isInkwellCloudSyncConfigured(): boolean {
  return getInkwellSupabasePublicConfig() != null
}
