/**
 * Hosted desktop installer URL for the marketing site (see `.env.example`).
 *
 * Uses `VITE_INKWELL_DESKTOP_DOWNLOAD_URL` when set; otherwise a build-time default
 * from `package.json` version → GitHub `MASK-VIII/inkwell` latest release asset (same
 * shape as `npm run print:desktop-download-url`).
 *
 * Absolute **https:** URL, **http:** on localhost, or an origin-relative path such as
 * **`/downloads/Inkwell-Setup-latest.exe`** (same-site hosting on Vercel).
 */
function normalizeDesktopDownloadUrl(candidate: string): string | null {
  const t = candidate.trim()
  if (!t.length) return null

  if (t.startsWith('/') && !t.startsWith('//')) {
    const pathOnly = (t.split(/[?#]/)[0] ?? '').toLowerCase()
    if (pathOnly === '/' || pathOnly === '/index.html') return null
    if (!/\.(exe|dmg)$/i.test(pathOnly)) return null
    return t.split(/[?#]/)[0] ?? t
  }

  let u: URL
  try {
    u = new URL(t)
  } catch {
    return null
  }

  const localHttp =
    u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
  if (u.protocol !== 'https:' && !localHttp) return null

  const path = u.pathname.toLowerCase()
  if (path === '/' || path === '/index.html') return null

  return u.href
}

export function getInkwellDesktopDownloadUrl(): string | null {
  const envRaw = import.meta.env.VITE_INKWELL_DESKTOP_DOWNLOAD_URL
  const chosen =
    typeof envRaw === 'string' && envRaw.trim().length > 0 ?
      envRaw.trim()
    : __INKWELL_DESKTOP_DOWNLOAD_DEFAULT__

  return normalizeDesktopDownloadUrl(chosen)
}
