import { Download, Share2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { isDesktopShell } from '../marketing/marketingRouting'

const DISMISS_KEY = 'inkwell.install-hint.dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function shouldHideInstallUI(): boolean {
  if (typeof window === 'undefined') return true
  if (isDesktopShell()) return true
  if (window.location.protocol === 'inkwell:') return true
  if (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)) return true
  return false
}

function isAlreadyInstalled(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return Boolean(nav.standalone)
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function isIosTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true
  return false
}

/**
 * Lightweight “Add to Home Screen” guidance + Chromium install prompt.
 * No service worker — installability still improves UX where the browser supports it.
 */
export function InstallToHomeScreen() {
  const [dismissed, setDismissed] = useState(readDismissed)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installBusy, setInstallBusy] = useState(false)
  const [installMessage, setInstallMessage] = useState<string | null>(null)

  useEffect(() => {
    if (shouldHideInstallUI() || isAlreadyInstalled() || dismissed) return
    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [dismissed])

  const onInstallClick = useCallback(async () => {
    if (!deferred) return
    setInstallBusy(true)
    setInstallMessage(null)
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      setInstallMessage(choice.outcome === 'accepted' ? 'Added to your home screen.' : 'Install was dismissed.')
      setDeferred(null)
    } catch {
      setInstallMessage('Install is not available in this browser right now.')
    } finally {
      setInstallBusy(false)
    }
  }, [deferred])

  const onDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }, [])

  if (shouldHideInstallUI() || isAlreadyInstalled() || dismissed) return null

  const showChromiumInstall = Boolean(deferred)
  const showIosHint = !showChromiumInstall && isIosTouchDevice()

  return (
    <section className="rounded-2xl border border-dust/80 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-panel-dark/70">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
          Install on this device
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="inkwell-btn-icon -m-1 h-9 w-9 shrink-0"
          aria-label="Dismiss install hint"
          title="Don’t show again"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-sm text-ink/75 dark:text-ink-dark/75">
        Add Inkwell to your home screen for a full-screen, app-like experience. Your library stays on this device in
        the browser.
      </p>

      {showChromiumInstall ?
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => void onInstallClick()}
            disabled={installBusy}
            className="inkwell-hub-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[12rem] disabled:opacity-50"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Install Inkwell
          </button>
        </div>
      : showIosHint ?
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-dust/70 bg-parchment/50 px-3 py-2.5 text-sm text-ink/85 dark:border-border-dark dark:bg-panel-dark/50 dark:text-ink-dark/85">
          <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-walnut dark:text-accent-warm" aria-hidden />
          <p>
            On Safari, tap the <strong className="font-semibold text-ink dark:text-ink-dark">Share</strong> button, then{' '}
            <strong className="font-semibold text-ink dark:text-ink-dark">Add to Home Screen</strong>.
          </p>
        </div>
      : (
        <p className="mt-4 text-sm text-ink/70 dark:text-ink-dark/70">
          Use your browser’s menu: look for <strong className="font-semibold text-ink dark:text-ink-dark">Install app</strong>,{' '}
          <strong className="font-semibold text-ink dark:text-ink-dark">Add to Home screen</strong>, or similar.
        </p>
      )}

      {installMessage ?
        <p className="mt-3 text-xs text-ink/60 dark:text-ink-dark/60" role="status">
          {installMessage}
        </p>
      : null}
    </section>
  )
}
