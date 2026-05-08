/**
 * Hosted desktop installer URL for the marketing site (see `.env.example`).
 * Empty when unset so builds without a release link ship clean UI.
 */
export function getInkwellDesktopDownloadUrl(): string | null {
  const raw = import.meta.env.VITE_INKWELL_DESKTOP_DOWNLOAD_URL
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length ? t : null
}
