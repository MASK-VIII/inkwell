const STORAGE_KEY = 'inkwell-play-animations'

/**
 * Whether Inkwell should use full UI motion (subject to CSS; panel slides use separate tokens).
 * Reads optional localStorage override, otherwise mirrors the system reduced-motion preference.
 */
export function readInitialPlayAnimations(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* ignore quota / private mode */
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Expose choice on `<html>` for future CSS or debugging (`data-inkwell-play-animations`). */
export function applyInkwellMotionDataset(playAnimations: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.inkwellPlayAnimations = playAnimations ? 'true' : 'false'
}
