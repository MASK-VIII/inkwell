/**
 * Path-based dispatcher for the inkwell.enterthelimelight.com host.
 *
 * The app is a hash-routed SPA that historically lived at `/`. Now `/` serves the
 * marketing landing and the workspace lives under `/app`. Returning users with old
 * bookmarks (e.g. `/#bookshelf`, `/?p=abc`) are redirected to `/app` so their
 * existing entry points keep working.
 *
 * On the production Inkwell subdomain, unknown paths resolve to the same SPA bundle;
 * send those to `/` so visitors always see the landing page unless they are on
 * `/app`, `/pricing`, `/buy`, `/legal/{privacy,terms,refund}`, the legacy
 * `/privacy`, `/terms`, `/refund` aliases, or `/changelog`.
 */

export type MarketingView =
  | 'landing'
  | 'pricing'
  | 'buy'
  | 'privacy'
  | 'terms'
  | 'refund'
  | 'changelog'
  | 'not_found'

/** Canonical hostname for the public marketing + web app deployment. */
export const INKWELL_MARKETING_HOST = 'inkwell.enterthelimelight.com'

const APP_PATH_PREFIX = '/app'

const KNOWN_HASH_PREFIXES = [
  '#write',
  '#bookshelf',
  '#account',
  '#signin',
  '#welcome',
  '#cloud-signin',
  '#format/',
  '#review/',
  '#publish',
  '#export',
]

export function pathIsApp(pathname: string): boolean {
  return pathname === APP_PATH_PREFIX || pathname.startsWith(`${APP_PATH_PREFIX}/`)
}

export function classifyMarketingPath(pathname: string): MarketingView {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized === '' || normalized === '/') return 'landing'
  if (normalized === '/pricing') return 'pricing'
  if (normalized === '/buy') return 'buy'
  // Canonical legal paths under `/legal/*` plus back-compat aliases at the root.
  if (normalized === '/legal/privacy' || normalized === '/privacy') return 'privacy'
  if (normalized === '/legal/terms' || normalized === '/terms') return 'terms'
  if (normalized === '/legal/refund' || normalized === '/refund') return 'refund'
  if (normalized === '/changelog') return 'changelog'
  return 'not_found'
}

export function isInkwellMarketingHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase()
  return h === INKWELL_MARKETING_HOST || h === `www.${INKWELL_MARKETING_HOST}`
}

export function shouldRedirectWwwInkwellToApex(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.toLowerCase() === `www.${INKWELL_MARKETING_HOST}`
}

export function redirectWwwInkwellToApex(): void {
  if (typeof window === 'undefined') return
  const { pathname, search, hash } = window.location
  window.location.replace(`https://${INKWELL_MARKETING_HOST}${pathname}${search}${hash}`)
}

/**
 * Any non-marketing, non-app path on the Inkwell subdomain should show the landing page.
 */
export function shouldRedirectInkwellMarketingUnknownPathToLanding(): boolean {
  if (typeof window === 'undefined') return false
  if (!isInkwellMarketingHostname(window.location.hostname)) return false
  if (isDesktopShell()) return false
  const pathname = window.location.pathname
  if (pathIsApp(pathname)) return false
  return classifyMarketingPath(pathname) === 'not_found'
}

export function redirectInkwellMarketingToLandingRoot(): void {
  if (typeof window === 'undefined') return
  const { search, hash } = window.location
  window.location.replace(`/${search}${hash}`)
}

/**
 * Returning Inkwell users had bookmarks under `/` before this split. If the URL
 * carries an Inkwell hash or a `?p=<projectId>` query, send them to `/app` and
 * keep the search/hash intact so their existing flow resumes verbatim.
 */
export function shouldRedirectLegacyUserToApp(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.pathname !== '/') return false
  const hash = window.location.hash || ''
  const search = window.location.search || ''
  const isKnownHash = KNOWN_HASH_PREFIXES.some((prefix) => hash.startsWith(prefix))
  const qs = new URLSearchParams(search)
  const hasProjectQuery = qs.has('p')
  const checkout = qs.get('checkout')?.trim().toLowerCase()
  const hasCheckoutQuery = Boolean(checkout && ['basic', 'pro', 'upgrade'].includes(checkout))
  return isKnownHash || hasProjectQuery || hasCheckoutQuery
}

export function redirectLegacyUserToApp(): void {
  if (typeof window === 'undefined') return
  const hash = window.location.hash || ''
  const search = window.location.search || ''
  window.location.replace(`${APP_PATH_PREFIX}${search}${hash}`)
}

/** Detect the Electron desktop shell. Desktop builds skip the marketing site. */
export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && Boolean(window.inkwellDesktop)
}
