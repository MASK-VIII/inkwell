import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeInkwellGates,
  normalizeInkwellTier,
  type InkwellEntitlementRow,
  type InkwellTier,
} from '../lib/inkwellEntitlements'
import { getInkwellSupabaseClient } from '../lib/sync/supabaseClient'
import type { InkwellSupabasePublicConfig } from '../lib/sync/syncEnv'

const ENTITLEMENT_CACHE_KEY = 'inkwell:last-known-paid-entitlement'
const ENTITLEMENT_CACHE_SCHEMA_VERSION = 1

export type InkwellEntitlementStatus =
  | 'anonymous'
  | 'loading'
  | 'verified'
  | 'offline_cached'
  | 'needs_signin'
  | 'error'

type CachedPaidEntitlement = {
  tier: Extract<InkwellTier, 'basic' | 'pro'>
  lastVerifiedAt: string
  schemaVersion: typeof ENTITLEMENT_CACHE_SCHEMA_VERSION
}

function readOfflineState(): boolean {
  return typeof navigator !== 'undefined' ? !navigator.onLine : false
}

function isPaidTier(tier: InkwellTier): tier is Extract<InkwellTier, 'basic' | 'pro'> {
  return tier === 'basic' || tier === 'pro'
}

function readCachedPaidEntitlement(): CachedPaidEntitlement | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(ENTITLEMENT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const maybe = parsed as Partial<CachedPaidEntitlement>
    const tier = normalizeInkwellTier(maybe.tier)
    if (!isPaidTier(tier)) return null
    if (maybe.schemaVersion !== ENTITLEMENT_CACHE_SCHEMA_VERSION) return null
    if (typeof maybe.lastVerifiedAt !== 'string' || Number.isNaN(Date.parse(maybe.lastVerifiedAt))) return null
    return { tier, lastVerifiedAt: maybe.lastVerifiedAt, schemaVersion: ENTITLEMENT_CACHE_SCHEMA_VERSION }
  } catch {
    return null
  }
}

function writeCachedPaidEntitlement(tier: InkwellTier): string | undefined {
  if (!isPaidTier(tier) || typeof localStorage === 'undefined') return undefined
  const lastVerifiedAt = new Date().toISOString()
  const blob: CachedPaidEntitlement = { tier, lastVerifiedAt, schemaVersion: ENTITLEMENT_CACHE_SCHEMA_VERSION }
  try {
    localStorage.setItem(ENTITLEMENT_CACHE_KEY, JSON.stringify(blob))
  } catch {
    /* ignore cache write failures */
  }
  return lastVerifiedAt
}

function clearCachedPaidEntitlement(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(ENTITLEMENT_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

function cachedRow(cached: CachedPaidEntitlement | null): InkwellEntitlementRow | null {
  return cached ? { tier: cached.tier, status: 'active' } : null
}

export function useInkwellEntitlements(config: InkwellSupabasePublicConfig | null) {
  const [row, setRow] = useState<InkwellEntitlementRow | null>(() => cachedRow(readCachedPaidEntitlement()))
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<InkwellEntitlementStatus>('loading')
  const [isOffline, setIsOffline] = useState(readOfflineState)
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | undefined>(() => readCachedPaidEntitlement()?.lastVerifiedAt)

  const load = useCallback(async () => {
    const offline = readOfflineState()
    const cached = readCachedPaidEntitlement()
    setIsOffline(offline)
    if (!config) {
      setRow(null)
      setUserId(null)
      setLastVerifiedAt(undefined)
      setStatus(offline ? 'needs_signin' : 'anonymous')
      return
    }
    setStatus('loading')
    const supabase = getInkwellSupabaseClient(config)
    const { data: sessionData } = await supabase.auth.getSession()
    let uid = sessionData.session?.user?.id ?? null
    setUserId(uid)
    if (!uid) {
      setRow(null)
      setLastVerifiedAt(undefined)
      setStatus(offline ? 'needs_signin' : 'anonymous')
      return
    }

    if (offline) {
      setRow(cachedRow(cached))
      setLastVerifiedAt(cached?.lastVerifiedAt)
      setStatus(cached ? 'offline_cached' : 'needs_signin')
      return
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    uid = userData.user?.id ?? null
    setUserId(uid)
    if (userError || !uid) {
      setRow(cachedRow(cached))
      setLastVerifiedAt(cached?.lastVerifiedAt)
      setStatus(cached ? 'error' : 'anonymous')
      return
    }

    const { data, error } = await supabase.from('user_entitlements').select('tier,status').maybeSingle()

    if (error) {
      console.warn('[inkwell] user_entitlements read failed', error.message)
      setRow(cachedRow(cached))
      setLastVerifiedAt(cached?.lastVerifiedAt)
      setStatus('error')
    } else if (data && typeof data === 'object' && 'tier' in data && 'status' in data) {
      const nextRow: InkwellEntitlementRow = {
        tier: normalizeInkwellTier(data.tier),
        status: String((data as { status: string }).status),
      }
      const gates = computeInkwellGates(nextRow)
      setRow(nextRow)
      const verifiedAt = isPaidTier(gates.tier) ? writeCachedPaidEntitlement(gates.tier) : undefined
      if (!isPaidTier(gates.tier)) clearCachedPaidEntitlement()
      setLastVerifiedAt(verifiedAt)
      setStatus('verified')
    } else {
      setRow(null)
      clearCachedPaidEntitlement()
      setLastVerifiedAt(undefined)
      setStatus('verified')
    }
  }, [config])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onNetworkChange = () => {
      void load()
    }
    window.addEventListener('online', onNetworkChange)
    window.addEventListener('offline', onNetworkChange)
    return () => {
      window.removeEventListener('online', onNetworkChange)
      window.removeEventListener('offline', onNetworkChange)
    }
  }, [load])

  useEffect(() => {
    if (!config) return
    const supabase = getInkwellSupabaseClient(config)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      queueMicrotask(() => {
        void load()
      })
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [config, load])

  const gates = useMemo(() => {
    return computeInkwellGates(row)
  }, [row])

  return {
    tier: gates.tier,
    status,
    isOffline,
    canUsePaidFeatures: gates.tier === 'basic' || gates.tier === 'pro',
    lastVerifiedAt,
    loading: status === 'loading',
    userId,
    row,
    gates,
    refetch: load,
  }
}

export const useEntitlements = useInkwellEntitlements
