/**
 * Paddle Billing webhook: verify signature and upsert public.user_entitlements.
 *
 * Secrets (Supabase Dashboard → Edge Functions → paddle-webhook → Secrets):
 * - PADDLE_WEBHOOK_SECRET
 * - SUPABASE_URL (often injected by platform)
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: map price IDs to tiers (comma-separated lists, first match wins):
 * - PADDLE_PRICE_IDS_EBOOK  (e.g. pri_abc,pri_def)
 * - PADDLE_PRICE_IDS_PRO
 * - PADDLE_PRICE_IDS_UPGRADE  ($99 upgrade → grants pro)
 *
 * Checkout must send custom_data: { "inkwell_user_id": "<supabase auth user uuid>" }.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const encoder = new TextEncoder()

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.trim().toLowerCase().replace(/^0x/, '')
  if (clean.length % 2 !== 0) return null
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16)
    if (Number.isNaN(byte)) return null
    out[i / 2] = byte
  }
  return out
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = hexToBytes(a)
  const bb = hexToBytes(b)
  if (!ba || !bb || ba.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i]
  return diff === 0
}

function parsePaddleSignature(header: string | null): { ts: string; h1: string } | null {
  if (!header) return null
  const parts = header.split(';').map((p) => p.trim())
  const map: Record<string, string> = {}
  for (const p of parts) {
    const eq = p.indexOf('=')
    if (eq === -1) continue
    map[p.slice(0, eq).trim()] = p.slice(eq + 1).trim()
  }
  const ts = map.ts
  const h1 = map.h1
  if (!ts || !h1) return null
  return { ts, h1 }
}

async function verifyPaddleSignature(rawBody: string, signatureHeader: string | null, secret: string): Promise<boolean> {
  const parsed = parsePaddleSignature(signatureHeader)
  if (!parsed) return false
  const tsNum = Number(parsed.ts)
  if (!Number.isFinite(tsNum)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNum) > 300) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${parsed.ts}:${rawBody}`))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return timingSafeEqualHex(hex, parsed.h1)
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!secret || !supabaseUrl || !serviceKey) {
    console.error('paddle-webhook: missing env (PADDLE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
    return new Response('Server misconfigured', { status: 500 })
  }

  const rawBody = await req.text()
  const sig =
    req.headers.get('paddle-signature') ??
    req.headers.get('Paddle-Signature') ??
    req.headers.get('Paddle-Signature'.toLowerCase())

  const okSig = await verifyPaddleSignature(rawBody, sig, secret)
  if (!okSig) {
    return new Response('Invalid signature', { status: 401 })
  }

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

  const userId = extractInkwellUserId(data)
  if (!userId) {
    console.warn('paddle-webhook: no inkwell_user_id in custom_data')
    return new Response(JSON.stringify({ ok: false, error: 'missing_inkwell_user_id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ebookIds = readIdSet('PADDLE_PRICE_IDS_EBOOK')
  const proIds = readIdSet('PADDLE_PRICE_IDS_PRO')
  const upgradeIds = readIdSet('PADDLE_PRICE_IDS_UPGRADE')
  const priceId = firstPriceIdFromPayload(data)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  if (isPaidSuccess(eventType)) {
    const tier = tierForPriceId(priceId, ebookIds, proIds, upgradeIds)
    if (!tier) {
      console.warn('paddle-webhook: could not map price to tier', { eventType, priceId })
      return new Response(JSON.stringify({ ok: false, error: 'unknown_price', priceId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const customerId =
      typeof (data.customer_id as string | undefined) === 'string' ?
        (data.customer_id as string)
      : typeof (data.customer as { id?: string } | undefined)?.id === 'string' ?
        (data.customer as { id: string }).id
      : null

    const txId = typeof data.id === 'string' ? data.id : null

    const { error } = await admin.from('user_entitlements').upsert(
      {
        user_id: userId,
        tier,
        source: 'paddle',
        status: 'active',
        paddle_customer_id: customerId,
        paddle_transaction_id: txId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      console.error('paddle-webhook: upsert failed', error)
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

  if (isRefundLike(eventType)) {
    const { error } = await admin
      .from('user_entitlements')
      .update({
        tier: 'free',
        status: 'revoked',
        source: 'paddle',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (error) {
      console.error('paddle-webhook: revoke failed', error)
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
