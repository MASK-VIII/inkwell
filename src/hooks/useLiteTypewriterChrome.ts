import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TypewriterMode } from '../lib/typewriterMode'
import { prefersReducedMotion } from '../lib/typewriterMode'

const LITE_IDLE_MS = 3000
const LITE_TOP_ZONE_PX = 24
const LITE_TOP_DWELL_MS = 250
const LITE_TOP_LEAVE_MS = 600

function clearTimer(id: { current: number | null }) {
  if (id.current != null) {
    window.clearTimeout(id.current)
    id.current = null
  }
}

/** Slim / idle chrome for Typewriter Lite (drawer collapsed). */
export function useLiteTypewriterChrome(typewriterMode: TypewriterMode) {
  const [idle, setIdle] = useState(false)
  const idleRef = useRef(idle)
  idleRef.current = idle

  const idleEnterTimerRef = useRef<number | null>(null)
  const topDwellTimerRef = useRef<number | null>(null)
  const topLeaveTimerRef = useRef<number | null>(null)
  const pointerInTopRef = useRef(false)

  const autoHideEnabled = typewriterMode === 'lite' && !prefersReducedMotion()

  const clearAllTimers = useCallback(() => {
    clearTimer(idleEnterTimerRef)
    clearTimer(topDwellTimerRef)
    clearTimer(topLeaveTimerRef)
  }, [])

  const scheduleIdleEnter = useCallback(() => {
    clearTimer(idleEnterTimerRef)
    if (!autoHideEnabled) return
    idleEnterTimerRef.current = window.setTimeout(() => {
      idleEnterTimerRef.current = null
      setIdle(true)
    }, LITE_IDLE_MS)
  }, [autoHideEnabled])

  const wakeChrome = useCallback(() => {
    setIdle(false)
    clearTimer(topDwellTimerRef)
    clearTimer(topLeaveTimerRef)
    scheduleIdleEnter()
  }, [scheduleIdleEnter])

  const notifyTyping = useCallback(() => {
    if (typewriterMode !== 'lite') return
    wakeChrome()
  }, [typewriterMode, wakeChrome])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle(
      'inkwell-typewriter-lite-idle',
      typewriterMode === 'lite' && idle,
    )
  }, [typewriterMode, idle])

  useEffect(() => {
    if (typewriterMode !== 'lite') {
      clearAllTimers()
      pointerInTopRef.current = false
      setIdle(false)
      return
    }
    setIdle(false)
    pointerInTopRef.current = false
    scheduleIdleEnter()
    return clearAllTimers
  }, [typewriterMode, scheduleIdleEnter, clearAllTimers])

  useEffect(() => {
    if (!autoHideEnabled) return

    const onPointerMove = (e: PointerEvent) => {
      const inTop = e.clientY <= LITE_TOP_ZONE_PX

      if (idleRef.current) {
        if (inTop) {
          if (!pointerInTopRef.current) {
            pointerInTopRef.current = true
            clearTimer(topDwellTimerRef)
            topDwellTimerRef.current = window.setTimeout(() => {
              topDwellTimerRef.current = null
              wakeChrome()
            }, LITE_TOP_DWELL_MS)
          }
        } else {
          pointerInTopRef.current = false
          clearTimer(topDwellTimerRef)
        }
        return
      }

      if (inTop) {
        clearTimer(topLeaveTimerRef)
        pointerInTopRef.current = true
      } else if (pointerInTopRef.current) {
        pointerInTopRef.current = false
        clearTimer(topLeaveTimerRef)
        topLeaveTimerRef.current = window.setTimeout(() => {
          topLeaveTimerRef.current = null
          clearTimer(idleEnterTimerRef)
          setIdle(true)
        }, LITE_TOP_LEAVE_MS)
      }
    }

    const onFocusIn = (e: FocusEvent) => {
      if (!idleRef.current) return
      const target = e.target
      if (!(target instanceof Element)) return
      if (target.closest('.inkwell-chrome-header, .inkwell-manuscript-toolbar')) {
        wakeChrome()
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('focusin', onFocusIn)
      clearTimer(topDwellTimerRef)
      clearTimer(topLeaveTimerRef)
    }
  }, [autoHideEnabled, wakeChrome])

  return { notifyTyping }
}
