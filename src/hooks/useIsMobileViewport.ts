import { useCallback, useEffect, useState } from 'react'

/** Matches Tailwind `sm` (640px): true when viewport is narrower than `sm`. */
const MOBILE_MQ = '(max-width: 639.98px)'

export function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(MOBILE_MQ).matches
  })

  const sync = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    setMobile(window.matchMedia(MOBILE_MQ).matches)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(MOBILE_MQ)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [sync])

  return mobile
}
