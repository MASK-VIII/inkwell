import { useEffect, useRef, type RefObject } from 'react'

const THEME_SHINE_EVENT = 'inkwell:theme-change' as const
/** Slightly longer than `--inkwell-theme-bridge-duration` so the CSS animation always completes. */
const SHINE_MS = 780

type ThemeShineDetail = { dark: boolean }

export function useThemeShine<T extends HTMLElement>(ref: RefObject<T | null>) {
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onChange = (e: Event) => {
      if (typeof window === 'undefined') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const el = ref.current
      if (!el) return
      const ce = e as CustomEvent<ThemeShineDetail>
      const nextIsDark = Boolean(ce.detail?.dark)
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
      el.removeAttribute('data-shine')
      void el.offsetWidth
      el.setAttribute('data-shine', nextIsDark ? 'dark' : 'light')
      clearTimerRef.current = setTimeout(() => {
        el.removeAttribute('data-shine')
        clearTimerRef.current = null
      }, SHINE_MS)
    }

    window.addEventListener(THEME_SHINE_EVENT, onChange as EventListener)
    return () => {
      window.removeEventListener(THEME_SHINE_EVENT, onChange as EventListener)
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [ref])
}
