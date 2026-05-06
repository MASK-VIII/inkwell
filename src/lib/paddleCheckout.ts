/**
 * Client-side Paddle checkout links (hosted checkout or overlay URLs).
 * Pass `inkwell_user_id` so the webhook can map purchases to Supabase Auth users.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'

/** Dispatched on `window` when Paddle reports checkout failures (listen in the app shell for user-visible toasts). */
export const INKWELL_PADDLE_CHECKOUT_UI_EVENT = 'inkwell-paddle-checkout-ui' as const

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
 */
export function openPaddleCheckoutUrl(url: string): boolean {
  if (!url) return false
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
    window.location.assign(url)
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
 * Set `VITE_PADDLE_EDGE_CHECKOUT=1` after deploying the function — bypasses broken dashboard default-payment-link UI
 * by passing `checkout.url` via Paddle's Transactions API.
 */
export async function invokeEdgePaddleCheckout(
  client: SupabaseClient,
  intent: PaddleCheckoutIntent,
): Promise<{ ok: true; url: string } | { ok: false; error: string; paddle?: unknown }> {
  const { data, error } = await client.functions.invoke<{
    url?: string
    error?: string
    paddle?: unknown
  }>('paddle-create-checkout', { body: { intent } })

  if (data?.url && typeof data.url === 'string') {
    return { ok: true, url: data.url }
  }

  if (error) {
    return {
      ok: false,
      error: error.message || 'edge_invoke_failed',
      paddle: data,
    }
  }

  return {
    ok: false,
    error: typeof data?.error === 'string' ? data.error : 'edge_no_url',
    paddle: data,
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
