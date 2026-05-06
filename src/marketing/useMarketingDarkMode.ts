import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

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
  const skipThemeShineRef = useRef(true)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  /** Match app `inkwell:theme-change` so `useThemeShine` on the marketing brand pill can run. */
  useEffect(() => {
    if (skipThemeShineRef.current) {
      skipThemeShineRef.current = false
      return
    }
    window.dispatchEvent(new CustomEvent('inkwell:theme-change', { detail: { dark: darkMode } }))
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

