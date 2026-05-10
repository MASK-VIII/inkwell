/**
 * Hosted desktop installer URL for the marketing site (see `.env.example`).
 *
 * Uses `VITE_INKWELL_DESKTOP_DOWNLOAD_URL` when set; otherwise a build-time default
 * from `package.json` version → GitHub `MASK-VIII/inkwell` latest release asset (same
 * shape as `npm run print:desktop-download-url`).
 *
 * Must be an absolute HTTPS URL to the installer binary (or GitHub release asset URL).
 * Relative paths like `/Setup.exe` resolve on the SPA host and often return `index.html`.
 */
function normalizeDesktopDownloadUrl(candidate: string): string | null {
  const t = candidate.trim()
  if (!t.length) return null

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
