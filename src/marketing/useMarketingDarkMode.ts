import { useCallback, useLayoutEffect, useMemo, useState } from 'react'

const THEME_KEY = 'inkwell-theme'

function readInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(THEME_KEY)
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
    return stored === 'dark' || (!stored && prefersDark)
  } catch {
    return false
  }
}

export function useMarketingDarkMode() {
  const [darkMode, setDarkMode] = useState(readInitialDarkMode)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const toggle = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return useMemo(() => ({ darkMode, toggle }), [darkMode, toggle])
}

