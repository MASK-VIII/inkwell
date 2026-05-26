export type TypewriterMode = 'off' | 'lite' | 'full'

export const TYPEWRITER_ENABLED_KEY = 'inkwell-typewriter-enabled'

export function readTypewriterEnabledFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(TYPEWRITER_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeTypewriterEnabledToStorage(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (enabled) localStorage.setItem(TYPEWRITER_ENABLED_KEY, '1')
    else localStorage.removeItem(TYPEWRITER_ENABLED_KEY)
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Effective typewriter mode for the Write workspace (books only). */
export function resolveTypewriterMode(
  route: string,
  isNote: boolean,
  typewriterEnabled: boolean,
  chaptersAsideCollapsed: boolean,
): TypewriterMode {
  if (route !== 'write' || isNote) return 'off'
  if (typewriterEnabled) return 'full'
  if (chaptersAsideCollapsed) return 'lite'
  return 'off'
}
