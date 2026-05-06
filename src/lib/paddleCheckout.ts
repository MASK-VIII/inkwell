/**
 * Client-side Paddle checkout links (hosted checkout or overlay URLs).
 * Pass `inkwell_user_id` so the webhook can map purchases to Supabase Auth users.
 */

import { initializePaddle, type Paddle } from '@paddle/paddle-js'

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

export function openPaddleCheckoutUrl(url: string): boolean {
  if (!url) return false
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
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
      ...(import.meta.env.DEV ?
        {
          debug: true,
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
            }
          },
        }
      : {}),
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
    return false
  }
}

export type PaddleCheckoutIntent = 'basic' | 'pro' | 'upgrade'

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
