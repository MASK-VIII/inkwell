/**
 * Client-side Paddle checkout links (hosted checkout or overlay URLs).
 * Pass `inkwell_user_id` so the webhook can map purchases to Supabase Auth users.
 */

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
