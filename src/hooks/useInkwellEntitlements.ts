import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeInkwellGates, type InkwellEntitlementRow } from '../lib/inkwellEntitlements'
import { getInkwellSupabaseClient } from '../lib/sync/supabaseClient'
import type { InkwellSupabasePublicConfig } from '../lib/sync/syncEnv'

export function useInkwellEntitlements(config: InkwellSupabasePublicConfig | null) {
  const [row, setRow] = useState<InkwellEntitlementRow | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!config) {
      setRow(null)
      setUserId(null)
      setLoading(false)
      return
    }
    const supabase = getInkwellSupabaseClient(config)
    const { data: sessionData } = await supabase.auth.getUser()
    const uid = sessionData.user?.id ?? null
    setUserId(uid)
    if (!uid) {
      setRow(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.from('user_entitlements').select('tier,status').maybeSingle()

    if (error) {
      console.warn('[inkwell] user_entitlements read failed', error.message)
      setRow(null)
    } else if (data && typeof data === 'object' && 'tier' in data && 'status' in data) {
      setRow({
        tier: data.tier as InkwellEntitlementRow['tier'],
        status: String((data as { status: string }).status),
      })
    } else {
      setRow(null)
    }
    setLoading(false)
  }, [config])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  useEffect(() => {
    if (!config) return
    const supabase = getInkwellSupabaseClient(config)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      queueMicrotask(() => {
        setLoading(true)
        void load()
      })
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [config, load])

  const gates = useMemo(() => {
    if (!config) {
      // Local/dev builds without Supabase: do not block exports or format workspaces.
      return computeInkwellGates({ tier: 'pro', status: 'active' })
    }
    return computeInkwellGates(row)
  }, [config, row])

  return {
    loading: config ? loading : false,
    userId,
    row,
    gates,
    refetch: load,
  }
}
