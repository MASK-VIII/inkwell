/**
 * Sandbox-only Paddle Billing webhook.
 *
 * This endpoint is intentionally permissive (no signature verification) so local
 * development on localhost can proceed even when Paddle's sandbox secret/signature
 * tooling is flaky. Do NOT use this for production.
 *
 * Deploy with `--no-verify-jwt` and point the *sandbox* notification destination here.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

function readIdSet(envName: string): Set<string> {
  const raw = (Deno.env.get(envName) ?? '').trim()
  if (!raw) return new Set()
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

/** Basic tier: sandbox names, then shared plural/singular keys. */
function readBasicTierPriceIds(): Set<string> {
  const sandbox = new Set([
    ...readIdSet('PADDLE_SANDBOX_PRICE_IDS_EBOOK'),
    ...readIdSet('PADDLE_SANDBOX_PRICE_IDS_BASIC'),
  ])
  if (sandbox.size > 0) return sandbox
  return new Set([
    ...readIdSet('PADDLE_PRICE_IDS_EBOOK'),
    ...readIdSet('PADDLE_PRICE_IDS_BASIC'),
    ...readIdSet('PADDLE_PRICE_ID_BASIC'),
  ])
}

function firstPriceIdFromPayload(data: Record<string, unknown>): string | null {
  const items = data.items as unknown[] | undefined
  const first = items?.[0] as Record<string, unknown> | undefined
  if (!first) return null
  const price = first.price as Record<string, unknown> | undefined
  if (price && typeof price.id === 'string') return price.id
  if (typeof first.price_id === 'string') return first.price_id
  const li = data.details as Record<string, unknown> | undefined
  const lineItems = li?.line_items as unknown[] | undefined
  const li0 = lineItems?.[0] as Record<string, unknown> | undefined
  if (li0) {
    const p = li0.price as Record<string, unknown> | undefined
    if (p && typeof p.id === 'string') return p.id
    if (typeof li0.price_id === 'string') return li0.price_id
  }
  return null
}

function extractInkwellUserId(data: Record<string, unknown>): string | null {
  const cd = data.custom_data as Record<string, unknown> | undefined
  if (!cd) return null
  const v = cd.inkwell_user_id ?? cd.user_id
  if (typeof v === 'string' && v.length > 0) return v
  return null
}

function extractPaddleCustomerId(data: Record<string, unknown>): string | null {
  if (typeof data.customer_id === 'string' && data.customer_id.length > 0) return data.customer_id
  const c = data.customer as { id?: string } | undefined
  if (c && typeof c.id === 'string' && c.id.length > 0) return c.id
  return null
}

function tierForPriceId(
  priceId: string | null,
  ebookIds: Set<string>,
  proIds: Set<string>,
  upgradeIds: Set<string>,
): 'ebook_suite' | 'pro' | null {
  if (!priceId) return null
  if (upgradeIds.has(priceId) || proIds.has(priceId)) return 'pro'
  if (ebookIds.has(priceId)) return 'ebook_suite'
  return null
}

function isPaidSuccess(eventType: string): boolean {
  return (
    eventType === 'transaction.completed' ||
    eventType === 'transaction.paid' ||
    eventType === 'transaction.ready'
  )
}

function isRefundLike(eventType: string): boolean {
  return (
    eventType === 'transaction.refunded' ||
    eventType === 'transaction.canceled' ||
    eventType === 'transaction.payment_failed'
  )
}

/** Paddle Billing refunds usually surface as adjustments; subscribe to adjustment.* in the dashboard. */
function isApprovedRefundAdjustment(eventType: string, data: Record<string, unknown>): boolean {
  if (eventType !== 'adjustment.created' && eventType !== 'adjustment.updated') return false
  const action = typeof data.action === 'string' ? data.action.toLowerCase() : ''
  if (action !== 'refund') return false
  const status = typeof data.status === 'string' ? data.status.toLowerCase() : ''
  return status === 'approved'
}

function shouldRevokeEntitlement(eventType: string, data: Record<string, unknown>): boolean {
  if (isRefundLike(eventType)) return true
  return isApprovedRefundAdjustment(eventType, data)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    console.error('paddle-webhook-sandbox: missing env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
    return new Response('Server misconfigured', { status: 500 })
  }

  const rawBody = await req.text()
  let payload: { event_type?: string; data?: Record<string, unknown> }
  try {
    payload = JSON.parse(rawBody) as { event_type?: string; data?: Record<string, unknown> }
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const eventType = typeof payload.event_type === 'string' ? payload.event_type : ''
  const data = payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : null
  if (!data) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const inkwellUserId = extractInkwellUserId(data)
  const paddleCustomerId = extractPaddleCustomerId(data)

  const ebookIds = readBasicTierPriceIds()
  const proIds = (() => {
    const s = readIdSet('PADDLE_SANDBOX_PRICE_IDS_PRO')
    if (s.size > 0) return s
    return new Set([...readIdSet('PADDLE_PRICE_IDS_PRO'), ...readIdSet('PADDLE_PRICE_ID_PRO')])
  })()
  const upgradeIds = (() => {
    const s = readIdSet('PADDLE_SANDBOX_PRICE_IDS_UPGRADE')
    if (s.size > 0) return s
    return new Set([
      ...readIdSet('PADDLE_PRICE_IDS_UPGRADE'),
      ...readIdSet('PADDLE_PRICE_ID_UPGRADE'),
    ])
  })()
  const priceId = firstPriceIdFromPayload(data)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  if (isPaidSuccess(eventType)) {
    if (!inkwellUserId) {
      console.warn('paddle-webhook-sandbox: no inkwell_user_id in custom_data (required for paid events)')
      return new Response(JSON.stringify({ ok: false, error: 'missing_inkwell_user_id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const tier = tierForPriceId(priceId, ebookIds, proIds, upgradeIds)
    if (!tier) {
      console.warn('paddle-webhook-sandbox: could not map price to tier', { eventType, priceId })
      return new Response(JSON.stringify({ ok: false, error: 'unknown_price', priceId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const txId = typeof data.id === 'string' ? data.id : null
    const { error } = await admin.from('user_entitlements').upsert(
      {
        user_id: inkwellUserId,
        tier,
        source: 'paddle_sandbox',
        status: 'active',
        paddle_customer_id: paddleCustomerId,
        paddle_transaction_id: txId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      console.error('paddle-webhook-sandbox: upsert failed', error)
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, tier }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (shouldRevokeEntitlement(eventType, data)) {
    let targetUserId = inkwellUserId
    if (!targetUserId && paddleCustomerId) {
      const { data: row, error: qErr } = await admin
        .from('user_entitlements')
        .select('user_id')
        .eq('paddle_customer_id', paddleCustomerId)
        .maybeSingle()
      if (qErr) {
        console.error('paddle-webhook-sandbox: lookup user for revoke failed', qErr)
        return new Response(JSON.stringify({ ok: false, error: qErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      targetUserId = row && typeof (row as { user_id?: string }).user_id === 'string' ? (row as { user_id: string }).user_id : null
    }
    if (!targetUserId) {
      console.warn('paddle-webhook-sandbox: cannot resolve user for revoke', { eventType, paddleCustomerId })
      return new Response(JSON.stringify({ ok: false, error: 'cannot_resolve_user_for_revoke' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { error } = await admin
      .from('user_entitlements')
      .update({
        tier: 'free',
        status: 'revoked',
        source: 'paddle_sandbox',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', targetUserId)

    if (error) {
      console.error('paddle-webhook-sandbox: revoke failed', error)
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, revoked: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, ignored: true, eventType }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

