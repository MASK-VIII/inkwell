import type { SupportedStorage } from '@supabase/supabase-js'

function webGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function webSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function webRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/**
 * Supabase Auth session storage: browser localStorage, or Electron secure KV (see preload).
 */
export function createInkwellAuthStorage(): SupportedStorage {
  const desktop = typeof window !== 'undefined' ? window.inkwellDesktop : undefined
  const secure = desktop?.authStorage

  if (secure?.getItem && secure?.setItem && secure?.removeItem) {
    return {
      getItem: (key: string) => secure.getItem!(key),
      setItem: (key: string, value: string) => secure.setItem!(key, value),
      removeItem: (key: string) => secure.removeItem!(key),
    }
  }

  return {
    getItem: (key: string) => webGet(key),
    setItem: (key: string, value: string) => webSet(key, value),
    removeItem: (key: string) => webRemove(key),
  }
}
