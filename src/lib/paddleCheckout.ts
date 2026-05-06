/**
 * Client-side Paddle checkout links (hosted checkout or overlay URLs).
 * Pass `inkwell_user_id` so the webhook can map purchases to Supabase Auth users.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'

/** Dispatched on `window` when Paddle reports checkout failures (listen in the app shell for user-visible toasts). */
export const INKWELL_PADDLE_CHECKOUT_UI_EVENT = 'inkwell-paddle-checkout-ui' as const

/** Persist checkout intent while the user completes cloud sign-in (`?checkout=` deep links). */
export const INKWELL_PENDING_CHECKOUT_STORAGE_KEY = 'inkwell_pending_checkout'

export type InkwellPaddleCheckoutUiDetail = {
  kind: 'error'
  message: string
  code?: string
  name?: string
}

function dispatchPaddleCheckoutUi(detail: InkwellPaddleCheckoutUiDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(INKWELL_PADDLE_CHECKOUT_UI_EVENT, { detail }))
}

function paddleEnvironmentFromToken(token: string): 'production' | 'sandbox' | null {
  const t = token.trim().toLowerCase()
  if (t.startsWith('test_')) return 'sandbox'
  if (t.startsWith('live_')) return 'production'
  return null
}

export type PaddleCheckoutEnv = {
  ebookSuite: string
  pro: string
  upgrade: string
}

/**
 * Server-side `paddle-create-checkout` — **opt-in** (`VITE_PADDLE_EDGE_CHECKOUT=1`) so checkout works with
 * **Vercel-only** Paddle vars (client token + `pri_` IDs). Enable edge after Supabase secrets are set.
 */
export function isPaddleEdgeCheckoutEnabled(supabasePublicConfigured: boolean): boolean {
  if (!supabasePublicConfigured) return false
  const v = String(import.meta.env.VITE_PADDLE_EDGE_CHECKOUT ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function getPaddleCheckoutEnv(): PaddleCheckoutEnv {
  return {
    ebookSuite: String(import.meta.env.VITE_PADDLE_CHECKOUT_EBOOK_SUITE ?? '').trim(),
    pro: String(import.meta.env.VITE_PADDLE_CHECKOUT_PRO ?? '').trim(),
    upgrade: String(import.meta.env.VITE_PADDLE_CHECKOUT_UPGRADE ?? '').trim(),
  }
}

export type PaddleOverlayEnv = {
  token: string
  environment: 'production' | 'sandbox'
  priceBasic: string
  pricePro: string
  priceUpgrade: string
}

export function getPaddleOverlayEnv(): PaddleOverlayEnv {
  const token = String(import.meta.env.VITE_PADDLE_CLIENT_TOKEN ?? '').trim()
  const envRaw = String(import.meta.env.VITE_PADDLE_ENVIRONMENT ?? '').trim().toLowerCase()
  const fromEnv: PaddleOverlayEnv['environment'] = envRaw === 'sandbox' ? 'sandbox' : 'production'
  const fromToken = paddleEnvironmentFromToken(token)
  const environment = fromToken ?? fromEnv

  if (
    import.meta.env.DEV &&
    fromToken != null &&
    fromToken !== fromEnv &&
    token
  ) {
    console.warn(
      '[inkwell] VITE_PADDLE_ENVIRONMENT does not match the client token (test_=sandbox, live_=production). Using the environment implied by the token.',
    )
  }

  return {
    token,
    environment,
    priceBasic: String(import.meta.env.VITE_PADDLE_PRICE_ID_BASIC ?? '').trim(),
    pricePro: String(import.meta.env.VITE_PADDLE_PRICE_ID_PRO ?? '').trim(),
    priceUpgrade: String(import.meta.env.VITE_PADDLE_PRICE_ID_UPGRADE ?? '').trim(),
  }
}

export function appendInkwellUserToCheckoutUrl(url: string, userId: string | null | undefined): string {
  if (!url || !userId) return url
  try {
    const base =
      typeof window !== 'undefined' && /^https?:\/\//i.test(url) ?
        undefined
      : typeof window !== 'undefined' ?
        window.location.origin
      : 'https://localhost'
    const u = new URL(url, base)
    u.searchParams.set('inkwell_user_id', userId)
    return u.toString()
  } catch {
    return url
  }
}

/**
 * Open Paddle-hosted or transaction checkout URLs.
 * Do not pass `noopener` via window.open's third argument — in many browsers that makes the
 * return value null even when the tab opens, and popup blockers also return null. We clear
 * `opener` manually when a Window is returned, and fall back to same-tab navigation so live
 * checkout still works (including `?checkout=` deep links with no user-gesture popup).
 *
 * Same-tab fallback: checkout URLs often target this app origin (`/app?…`). Assigning without a
 * hash reloads the SPA with `hash === ''`, which sends returning users to the bookshelf — so when
 * the assign target is same-origin and has no fragment, carry over the current hash (e.g. `#account`).
 *
 * Same-origin transaction URLs (`_ptxn=`): prefer `location.assign` immediately — `window.open` is
 * often blocked when there is no user gesture (e.g. after `await invokeEdgePaddleCheckout`).
 */
export function openPaddleCheckoutUrl(url: string): boolean {
  if (!url) return false
  try {
    if (typeof window !== 'undefined') {
      const resolved = new URL(url, window.location.href)
      const sameOrigin = resolved.origin === window.location.origin
      const txnCheckout = /[?&]_ptxn=/i.test(resolved.search)
      if (sameOrigin && txnCheckout) {
        const frag = window.location.hash
        if (!resolved.hash && frag && frag !== '#') resolved.hash = frag
        window.location.assign(resolved.toString())
        return true
      }
    }
  } catch {
    /* fall through to window.open */
  }
  try {
    const w = window.open(url, '_blank')
    if (w) {
      try {
        w.opener = null
      } catch {
        /* ignore */
      }
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    let navigateUrl = url
    if (typeof window !== 'undefined') {
      const resolved = new URL(url, window.location.href)
      const frag = window.location.hash
      if (resolved.origin === window.location.origin && !resolved.hash && frag && frag !== '#') {
        resolved.hash = frag
        navigateUrl = resolved.toString()
      }
    }
    window.location.assign(navigateUrl)
    return true
  } catch {
    return false
  }
}

let cachedPaddle: Paddle | undefined = undefined

async function getPaddleOverlayInstance(): Promise<Paddle | undefined> {
  if (cachedPaddle) return cachedPaddle
  const o = getPaddleOverlayEnv()
  if (!o.token) return undefined
  try {
    const paddle = await initializePaddle({
      token: o.token,
      environment: o.environment,
      version: 'v1',
      ...(import.meta.env.DEV ? { debug: true } : {}),
      eventCallback(event) {
        const name = event?.name ?? ''
        if (name === 'checkout.loaded') {
          console.info('[inkwell] Paddle checkout loaded')
        }
        if (
          name === 'checkout.error' ||
          name === 'checkout.failed' ||
          name === 'checkout.payment.error' ||
          name === 'checkout.payment.failed'
        ) {
          const detail = 'detail' in event && typeof event.detail === 'string' ? event.detail : undefined
          const code = 'code' in event && typeof event.code === 'string' ? event.code : undefined
          console.warn('[inkwell] Paddle checkout event', { name, code, detail, event })
          dispatchPaddleCheckoutUi({
            kind: 'error',
            message: [detail, code, name].filter(Boolean).join(' — ') || 'checkout_failed',
            code,
            name,
          })
        }
      },
    })
    if (paddle) cachedPaddle = paddle
    return paddle
  } catch (e) {
    console.error('[inkwell] Paddle initializePaddle failed', e)
    return undefined
  }
}

/** Start loading Paddle.js early (e.g. when upgrade modal opens) so checkout can open on the same click task. */
export function preloadPaddleCheckout(): Promise<Paddle | undefined> {
  return getPaddleOverlayInstance()
}

/**
 * If Paddle is already initialized, open checkout synchronously in the current user-activation task.
 * Browsers often block overlay/popup checkout if `Checkout.open` runs after an `await` from the click handler.
 */
export function tryOpenPaddleOverlayInSameTask(opts: {
  intent: PaddleCheckoutIntent
  userId: string
}): boolean {
  if (typeof window === 'undefined') return false
  const paddle = cachedPaddle
  if (!paddle) return false

  const overlay = getPaddleOverlayEnv()
  if (!overlay.token) return false

  const priceId =
    opts.intent === 'basic' ? overlay.priceBasic
    : opts.intent === 'pro' ? overlay.pricePro
    : overlay.priceUpgrade

  if (!priceId) return false

  try {
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      settings: { displayMode: 'overlay', variant: 'one-page' },
      customData: { inkwell_user_id: String(opts.userId) },
    })
    return true
  } catch (e) {
    console.error('[inkwell] Paddle.Checkout.open (sync) failed', e)
    dispatchPaddleCheckoutUi({
      kind: 'error',
      message: e instanceof Error ? e.message : String(e),
      name: 'checkout.open.exception',
    })
    return false
  }
}

export type PaddleCheckoutIntent = 'basic' | 'pro' | 'upgrade'

const VITE_PRICE_VAR: Record<PaddleCheckoutIntent, string> = {
  basic: 'VITE_PADDLE_PRICE_ID_BASIC',
  pro: 'VITE_PADDLE_PRICE_ID_PRO',
  upgrade: 'VITE_PADDLE_PRICE_ID_UPGRADE',
}

const SUPABASE_PRICE_SECRET: Record<PaddleCheckoutIntent, string> = {
  basic: 'PADDLE_PRICE_IDS_BASIC',
  pro: 'PADDLE_PRICE_IDS_PRO',
  upgrade: 'PADDLE_PRICE_IDS_UPGRADE',
}

/** Overlay / Paddle.js price id for this checkout intent (from Vite env). */
export function paddleOverlayPriceIdForIntent(intent: PaddleCheckoutIntent): string {
  const o = getPaddleOverlayEnv()
  const raw =
    intent === 'basic' ? o.priceBasic
    : intent === 'pro' ? o.pricePro
    : o.priceUpgrade
  return String(raw ?? '').trim()
}

/**
 * Non-empty when the client env price id is missing or looks like a catalog mistake (e.g. product id pro_… vs price pri_…).
 */
export function paddleOverlayPriceIdProblem(intent: PaddleCheckoutIntent): string | null {
  const id = paddleOverlayPriceIdForIntent(intent)
  if (!id) {
    return `Set ${VITE_PRICE_VAR[intent]} in Vercel (redeploy). For server checkout, also set ${SUPABASE_PRICE_SECRET[intent]} in Supabase Edge Function secrets.`
  }
  const low = id.toLowerCase()
  if (low.startsWith('pro_')) {
    return `${VITE_PRICE_VAR[intent]} is a product id (pro_…). Use the price id (pri_…) from Paddle → Catalog → Prices.`
  }
  if (!low.startsWith('pri_')) {
    return `${VITE_PRICE_VAR[intent]} must be a Paddle price id (starts with pri_).`
  }
  return null
}

/** User-visible explanation when paddle-create-checkout returns an error JSON body. */
export function humanizeEdgeCheckoutFailure(
  intent: PaddleCheckoutIntent,
  failure: { error: string; paddle?: unknown },
): string {
  const raw = failure.paddle as Record<string, unknown> | undefined
  const topErr = typeof raw?.error === 'string' ? raw.error : failure.error
  const detail = typeof raw?.detail === 'string' ? raw.detail : ''

  if (topErr === 'internal_error') {
    return detail ?
        `Checkout server error: ${detail.slice(0, 280)}`
      : 'Checkout server failed — open Supabase → Edge Functions → paddle-create-checkout → Logs.'
  }
  if (topErr === 'server_misconfigured') {
    return 'Checkout server missing Supabase env (should be automatic). Redeploy paddle-create-checkout or contact support.'
  }

  if (topErr === 'invalid_intent_or_price') {
    const label = intent === 'basic' ? 'Basic' : intent === 'pro' ? 'Pro' : 'Upgrade'
    return `Server checkout has no ${label} price configured: add Supabase secret ${SUPABASE_PRICE_SECRET[intent]} (same pri_… as ${VITE_PRICE_VAR[intent]} in Vercel), redeploy if needed, then try again.`
  }
  if (topErr === 'missing_paddle_api_key') {
    return 'Checkout server is missing secret PADDLE_API_KEY (Supabase → Edge Functions → paddle-create-checkout → Secrets).'
  }
  if (topErr === 'missing_paddle_checkout_page_url') {
    return (
      'Supabase is still serving an old paddle-create-checkout that required PADDLE_CHECKOUT_PAGE_URL. ' +
      'Redeploy the function from the current inkwell repo (`supabase functions deploy paddle-create-checkout` after `supabase link`); ' +
      'newer code uses a built-in default checkout URL when that secret is unset.'
    )
  }
  if (topErr === 'paddle_api_error') {
    try {
      const nested = raw?.paddle as Record<string, unknown> | undefined
      const errObj =
        nested && typeof nested.error === 'object' && nested.error !== null ?
          (nested.error as Record<string, unknown>)
        : undefined
      const code = typeof errObj?.code === 'string' ? errObj.code : ''
      const detailStr = typeof errObj?.detail === 'string' ? errObj.detail : ''
      if (code === 'transaction_checkout_url_domain_is_not_approved') {
        return `${detailStr || 'checkout.url host must be approved in Paddle'} — use https://inkwell.enterthelimelight.com/app or set secret PADDLE_CHECKOUT_PAGE_URL to an approved https URL.`
      }
      const bits = JSON.stringify(raw?.paddle ?? raw).slice(0, 420)
      return bits.length > 2 ? `Paddle API: ${bits}` : `Paddle API error (${String(raw?.status ?? '')}).`
    } catch {
      return 'Paddle API error from checkout server.'
    }
  }
  if (topErr === 'unauthorized' || topErr === 'missing_authorization') {
    return 'Sign in again, then retry checkout (session could not reach checkout server).'
  }
  if (topErr === 'sign_in_required_refresh_cloud_sync') {
    return 'Sign in to cloud sync again, then retry checkout.'
  }
  return `Checkout: ${topErr}`
}

/**
 * True when checkout will use Paddle.js overlay (no hosted checkout URL, no edge transaction URL).
 * In that case `Checkout.open` must run in the same user-activation task as the click, so the client
 * should preload Paddle (`preloadPaddleCheckout`) before enabling the checkout button.
 */
export function paddleUpgradeNeedsPrimedOverlay(opts: {
  intent: PaddleCheckoutIntent
  edgeCheckoutEnabled: boolean
}): boolean {
  const env = getPaddleCheckoutEnv()
  const hosted =
    opts.intent === 'basic' ? env.ebookSuite
    : opts.intent === 'pro' ? env.pro
    : env.upgrade
  if (Boolean(hosted?.trim())) return false
  if (opts.edgeCheckoutEnabled) return false
  return Boolean(getPaddleOverlayEnv().token.trim())
}

/**
 * Server-created Paddle transaction (`paddle-create-checkout` Edge Function).
 * Deploy `paddle-create-checkout` and keep Supabase env configured. Client uses this when
 * `isPaddleEdgeCheckoutEnabled` is true (`VITE_PADDLE_EDGE_CHECKOUT=1`).
 */
export async function invokeEdgePaddleCheckout(
  client: SupabaseClient,
  intent: PaddleCheckoutIntent,
): Promise<{ ok: true; url: string } | { ok: false; error: string; paddle?: unknown }> {
  let { data: sessionData } = await client.auth.getSession()
  let session = sessionData.session ?? null
  if (!session?.access_token) {
    const { data: refreshData } = await client.auth.refreshSession()
    session = refreshData.session ?? null
  }
  if (!session?.access_token) {
    return { ok: false, error: 'sign_in_required_refresh_cloud_sync', paddle: undefined }
  }

  const { data, error } = await client.functions.invoke<{
    url?: string
    error?: string
    detail?: string
  }>('paddle-create-checkout', {
    body: { intent },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (data?.url && typeof data.url === 'string') {
    return { ok: true, url: data.url }
  }

  /** Edge Functions often return JSON in `data` even when `error` is set (non-2xx). */
  const body =
    data && typeof data === 'object' ?
      (data as { url?: string; error?: string; detail?: string })
    : undefined
  const serverErr = typeof body?.error === 'string' ? body.error : undefined
  const serverDetail = typeof body?.detail === 'string' ? body.detail : undefined
  const synthesized =
    serverDetail ? `${serverErr ?? 'checkout'}: ${serverDetail}`
    : serverErr ?? undefined

  if (error) {
    console.warn('[inkwell] paddle-create-checkout invoke failed', intent, {
      clientMessage: error.message,
      serverBody: body,
    })
    return {
      ok: false,
      error: synthesized ?? error.message ?? 'edge_invoke_failed',
      paddle: body ?? data,
    }
  }

  return {
    ok: false,
    error: synthesized ?? 'edge_no_url',
    paddle: body ?? data,
  }
}

export async function openPaddleCheckoutOverlay(opts: {
  intent: PaddleCheckoutIntent
  userId: string | null | undefined
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'overlay_unavailable' }
  const overlay = getPaddleOverlayEnv()
  if (!overlay.token) return { ok: false, error: 'missing_paddle_client_token' }

  const priceId =
    opts.intent === 'basic' ? overlay.priceBasic
    : opts.intent === 'pro' ? overlay.pricePro
    : overlay.priceUpgrade

  if (!priceId) return { ok: false, error: 'missing_price_id' }
  if (!opts.userId) return { ok: false, error: 'missing_inkwell_user_id' }

  try {
    const paddle = await getPaddleOverlayInstance()
    if (!paddle) return { ok: false, error: 'paddle_init_failed' }

    try {
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        settings: { displayMode: 'overlay', variant: 'one-page' },
        customData: { inkwell_user_id: String(opts.userId) },
      })
    } catch (e) {
      console.error('[inkwell] Paddle.Checkout.open failed', e)
      return { ok: false, error: 'checkout_open_failed' }
    }
    return { ok: true }
  } catch (e) {
    console.error('[inkwell] openPaddleCheckoutOverlay failed', e)
    return { ok: false, error: 'checkout_open_failed' }
  }
}
