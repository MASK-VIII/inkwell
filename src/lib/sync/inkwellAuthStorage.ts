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
      getItem: async (key: string) => {
        try {
          return await secure.getItem!(key)
        } catch {
          return null
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await secure.setItem!(key, value)
        } catch {
          /* ignore (non-persistent session is still OK) */
        }
      },
      removeItem: async (key: string) => {
        try {
          await secure.removeItem!(key)
        } catch {
          /* ignore */
        }
      },
    }
  }

  // Desktop shell present but secure storage bridge missing/unavailable.
  // Do not fall back to renderer localStorage (plaintext refresh tokens).
  if (desktop) {
    const mem = new Map<string, string>()
    return {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value)
      },
      removeItem: (key: string) => {
        mem.delete(key)
      },
    }
  }

  return {
    getItem: (key: string) => webGet(key),
    setItem: (key: string, value: string) => webSet(key, value),
    removeItem: (key: string) => webRemove(key),
  }
}
