import { useCallback, useEffect, useState } from 'react'

/**
 * Packaged Windows: banner after `electron-updater` finishes downloading the next NSIS build.
 * Background checks + View → Check for updates… live in `electron/main.cjs`.
 */
export function DesktopAutoUpdate() {
  const updates = typeof window !== 'undefined' ? window.inkwellDesktop?.updates : undefined
  const [banner, setBanner] = useState<{ version: string } | null>(null)

  useEffect(() => {
    if (!updates?.onStatus) return
    return updates.onStatus((msg) => {
      if (msg.kind === 'downloaded' && msg.version.trim()) {
        setBanner({ version: msg.version.trim() })
      }
    })
  }, [updates])

  const onRestart = useCallback(async () => {
    await updates?.quitAndInstall()
  }, [updates])

  const onLater = useCallback(() => setBanner(null), [])

  if (!updates || !banner) return null

  return (
    <div
      role="dialog"
      aria-labelledby="inkwell-update-banner-title"
      className="fixed bottom-24 left-1/2 z-[10000] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-dust bg-panel-light-strong px-4 py-3 shadow-2xl dark:border-border-dark dark:bg-panel-dark sm:px-5 sm:py-4"
    >
      <p id="inkwell-update-banner-title" className="text-sm font-semibold text-ink dark:text-ink-dark">
        Update ready
      </p>
      <p className="mt-1 text-xs leading-snug text-ink/70 dark:text-ink-dark/70">
        Inkwell {banner.version} has been downloaded. Restart to finish installing (you will be prompted to
        close the app first).
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="rounded-xl border border-dust px-3 py-1.5 text-xs font-semibold text-ink/80 hover:bg-dust/25 dark:border-border-dark dark:text-ink-dark/85 dark:hover:bg-border-dark/40"
          onClick={onLater}
        >
          Later
        </button>
        <button
          type="button"
          className="rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-parchment hover:opacity-95 dark:bg-cream dark:text-ink"
          onClick={onRestart}
        >
          Restart now
        </button>
      </div>
    </div>
  )
}
