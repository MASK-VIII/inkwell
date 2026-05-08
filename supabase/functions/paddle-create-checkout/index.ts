/**
 * Creates a Paddle Billing transaction server-side and returns checkout.url.
 *
 * Bypasses the vendor-dashboard "default payment link" UI when that screen is broken:
 * the Transactions API accepts `checkout.url` for an approved domain (see Paddle API:
 * Create transaction → checkout.url).
 *
 * Secrets (Supabase Dashboard → Edge Functions → paddle-create-checkout):
 * - PADDLE_API_KEY          — Paddle Developer Tools → Authentication → API keys (server)
 * - PADDLE_ENVIRONMENT      — optional: "sandbox" | "production" (default: production)
 * - PADDLE_CHECKOUT_PAGE_URL — optional override; page that loads Paddle.js on a Paddle-approved domain.
 *   If unset, the function uses Inkwell’s production default (`https://inkwell.enterthelimelight.com/app`).
 *   Self-hosted forks should set this secret (or edit DEFAULT_CHECKOUT_PAGE_URL in code).
 *
 * Reuses the same price-ID lists as paddle-webhook:
 * - PADDLE_PRICE_IDS_BASIC or PADDLE_PRICE_IDS_EBOOK (basic); singular PADDLE_PRICE_ID_* also accepted
 * - PADDLE_PRICE_IDS_PRO (or PADDLE_PRICE_ID_PRO)
 * - PADDLE_PRICE_IDS_UPGRADE (or PADDLE_PRICE_ID_UPGRADE)
 *
 * Client: set VITE_PADDLE_EDGE_CHECKOUT=1 in Vercel to call this function; otherwise the app uses Paddle.js only.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

/** Paddle-approved host for hosted checkout `checkout.url` when `PADDLE_CHECKOUT_PAGE_URL` is not set. */
const DEFAULT_CHECKOUT_PAGE_URL = 'https://inkwell.enterthelimelight.com/app'

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false
  const o = origin.trim()
  if (!o) return false
  // Web production + local dev + Electron desktop shell origin.
  return (
    o === 'https://inkwell.enterthelimelight.com' ||
    o === 'http://localhost:5173' ||
    o === 'http://127.0.0.1:5173' ||
    o === 'inkwell://app'
  )
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = isAllowedOrigin(origin) ? origin!.trim() : 'null'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function firstPriceIdFromEnv(keys: string[]): string | null {
  for (const k of keys) {
    const raw = (Deno.env.get(k) ?? '').trim()
    if (!raw) continue
    const first = raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)[0]
    if (first) return first
  }
  return null
}

function paddleApiBase(): string {
  const env = (Deno.env.get('PADDLE_ENVIRONMENT') ?? 'production').trim().toLowerCase()
  return env === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'
}

function extractCheckoutUrl(body: Record<string, unknown>): string | null {
  const data = body.data as Record<string, unknown> | undefined
  if (!data) return null
  const checkout = data.checkout as Record<string, unknown> | undefined
  if (checkout && typeof checkout.url === 'string') return checkout.url
  const attrs = data.attributes as Record<string, unknown> | undefined
  const ch = attrs?.checkout as Record<string, unknown> | undefined
  if (ch && typeof ch.url === 'string') return ch.url
  return null
}

/** Paddle sometimes nests checkout URL differently across API versions — tolerate loose shapes. */
function extractCheckoutUrlLoose(body: Record<string, unknown>): string | null {
  const direct = extractCheckoutUrl(body)
  if (direct) return direct
  try {
    const s = JSON.stringify(body)
    const m = s.match(/https?:\/\/[^\s"']+\?_ptxn=[a-z0-9_]+/i)
    return m ? m[0] : null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  try {
    return await handlePaddleCreateCheckout(req)
  } catch (e) {
    console.error('paddle-create-checkout: unhandled', e)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    })
  }
})

async function handlePaddleCreateCheckout(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const paddleKey = Deno.env.get('PADDLE_API_KEY') ?? ''
  /** Trim — stray whitespace breaks Paddle’s approved-domain match. */
  const checkoutPageUrlFromSecret = (Deno.env.get('PADDLE_CHECKOUT_PAGE_URL') ?? '').trim()
  const checkoutPageUrl = checkoutPageUrlFromSecret || DEFAULT_CHECKOUT_PAGE_URL
  if (!checkoutPageUrlFromSecret) {
    console.warn(
      'paddle-create-checkout: PADDLE_CHECKOUT_PAGE_URL unset; using DEFAULT_CHECKOUT_PAGE_URL for checkout.url',
    )
  }

  if (!supabaseUrl || !anonKey) {
    console.error('paddle-create-checkout: missing SUPABASE_URL or SUPABASE_ANON_KEY')
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  if (!paddleKey) {
    return new Response(JSON.stringify({ error: 'missing_paddle_api_key' }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  const user = userData?.user
  if (userErr || !user?.id) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  let intent: string
  try {
    const body = (await req.json()) as { intent?: string }
    intent = typeof body.intent === 'string' ? body.intent.trim().toLowerCase() : ''
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const priceId =
    intent === 'basic' ?
      firstPriceIdFromEnv(['PADDLE_PRICE_IDS_BASIC', 'PADDLE_PRICE_IDS_EBOOK', 'PADDLE_PRICE_ID_BASIC'])
    : intent === 'pro' ? firstPriceIdFromEnv(['PADDLE_PRICE_IDS_PRO', 'PADDLE_PRICE_ID_PRO'])
    : intent === 'upgrade' ?
      firstPriceIdFromEnv(['PADDLE_PRICE_IDS_UPGRADE', 'PADDLE_PRICE_ID_UPGRADE'])
    : null

  if (!priceId || !['basic', 'pro', 'upgrade'].includes(intent)) {
    return new Response(JSON.stringify({ error: 'invalid_intent_or_price', intent }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const payload = {
    items: [{ price_id: priceId, quantity: 1 }],
    collection_mode: 'automatic',
    /** Needed so Paddle Checkout can open for this transaction (dashboard defaults irrelevant). */
    enable_checkout: true,
    custom_data: { inkwell_user_id: user.id },
    checkout: { url: checkoutPageUrl },
  }

  const apiUrl = `${paddleApiBase()}/transactions`
  let paddleRes: Response
  try {
    paddleRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paddleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.error('paddle-create-checkout: fetch failed', e)
    return new Response(JSON.stringify({ error: 'paddle_network_error' }), {
      status: 502,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const rawText = await paddleRes.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(rawText) as Record<string, unknown>
  } catch {
    console.error('paddle-create-checkout: non-json response', paddleRes.status, rawText.slice(0, 500))
    return new Response(JSON.stringify({ error: 'paddle_invalid_response', status: paddleRes.status }), {
      status: 502,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  if (!paddleRes.ok) {
    console.warn('paddle-create-checkout: paddle error', paddleRes.status, json)
    return new Response(JSON.stringify({ error: 'paddle_api_error', status: paddleRes.status, paddle: json }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const url = extractCheckoutUrlLoose(json)
  if (!url) {
    console.error('paddle-create-checkout: no checkout.url in response', json)
    return new Response(JSON.stringify({ error: 'missing_checkout_url', paddle: json }), {
      status: 502,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ url }), {
    status: 200,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}
