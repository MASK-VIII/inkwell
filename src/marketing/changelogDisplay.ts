/**
 * Light cleanup so auto-imported commit titles read a bit more like notes for writers.
 * Prefer plain-language commit subjects (see `scripts/generate-changelog.mjs`); this only
 * trims noise—backticks, noisy path chips—before display.
 */
export function humanizeChangelogTitle(raw: string): string {
  let s = raw.trim().replace(/^["']|["']$/g, '')
  if (!s) return s

  // Drop inline code fences but keep plain words inside when helpful
  s = s.replace(/`([^`]+)`/g, (_, inner: string) => {
    const t = inner.trim()
    if (/^(?:src|public|supabase|scripts)\//i.test(t)) return ''
    if (/^[A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)+$/.test(t)) return ''
    return t
  })
  s = s.replace(/\s+/g, ' ').trim()

  s = s.replace(/\b(?:src|public|supabase|scripts)\/[a-zA-Z0-9_./-]+\b/g, '').replace(/\s+/g, ' ').trim()
  s = s.replace(/^\s*[,–—-]+\s*|\s*[,–—-]+\s*$/g, '').trim()
  s = s.replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim()

  if (s.length && /^[a-z]/.test(s)) {
    s = s.charAt(0).toUpperCase() + s.slice(1)
  }

  return s
}
