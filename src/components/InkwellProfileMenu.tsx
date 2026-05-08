import { User } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export type InkwellProfileMenuProps = {
  userEmail: string | null
  cloudSyncConfigured: boolean
  onSyncNow: () => void
  onSignOutCloud: () => void | Promise<void>
  onAppSignOut: () => void
  showLibraryHubLink: boolean
  /** Cloud sign-in screen; show when sync is configured and there is no cloud session. */
  onGoToSignIn?: () => void
  /** When set, opens the Account screen (#account). */
  onGoToAccount?: () => void
  onGoToLibraryHub: () => void
  menuAlign?: 'left' | 'right'
  menuOpen?: boolean
  onMenuOpenChange?: (open: boolean) => void
  onRequestExclusiveOpen?: () => void
}

export function InkwellProfileMenu({
  userEmail,
  cloudSyncConfigured,
  onSyncNow,
  onSignOutCloud,
  onAppSignOut,
  showLibraryHubLink,
  onGoToSignIn,
  onGoToAccount,
  onGoToLibraryHub,
  menuAlign = 'right',
  menuOpen: controlledOpen,
  onMenuOpenChange,
  onRequestExclusiveOpen,
}: InkwellProfileMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : uncontrolledOpen

  const setOpen = useCallback(
    (next: boolean) => {
      onMenuOpenChange?.(next)
      if (!controlled) setUncontrolledOpen(next)
    },
    [controlled, onMenuOpenChange],
  )

  const close = useCallback(() => setOpen(false), [setOpen])

  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const toggle = () => {
    onRequestExclusiveOpen?.()
    setOpen(!open)
  }

  const align = menuAlign === 'left' ? 'left-0' : 'right-0'
  const itemClass =
    'block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-dust/30 dark:text-ink-dark dark:hover:bg-border-dark/50'

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={toggle}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-dust bg-white/70 px-2.5 py-2 text-sm font-semibold text-ink outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-walnut/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90 dark:focus-visible:ring-cream/45 dark:focus-visible:ring-offset-panel-dark sm:px-3"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Profile"
        title="Profile"
      >
        <User className="h-5 w-5 shrink-0" strokeWidth={2.25} />
        <span className="hidden sm:inline">Profile</span>
      </button>
      {open ?
        <div
          role="menu"
          className={`absolute ${align} top-full z-[60] mt-2 w-[min(17.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-dust bg-white py-1 shadow-xl dark:border-border-dark dark:bg-panel-dark`}
        >
          <div className="flex gap-3 px-4 pb-3 pt-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink to-walnut text-xs font-bold uppercase tracking-[0.12em] text-parchment shadow-sm ring-1 ring-ink/20 dark:text-ink-dark dark:ring-cream/40">
              {userEmail ? userEmail.slice(0, 1).toUpperCase() : 'IW'}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-sm font-semibold text-ink dark:text-ink-dark">Inkwell writer</p>
              <p className="truncate text-xs text-ink/60 dark:text-ink-dark/60">
                {userEmail ? userEmail : 'Signed in on this device only'}
              </p>
            </div>
          </div>
          <div className="border-t border-dust/80 dark:border-border-dark" />
          <div className="px-1 py-1">
            {!userEmail && onGoToSignIn ?
              <button
                type="button"
                role="menuitem"
                className={`${itemClass} font-medium`}
                onClick={() => {
                  close()
                  onGoToSignIn()
                }}
              >
                Sign in
              </button>
            : null}
            {showLibraryHubLink ?
              <>
                {onGoToAccount ?
                  <button
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={() => {
                      close()
                      onGoToAccount()
                    }}
                  >
                    My account
                  </button>
                : null}
                <button
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => {
                    close()
                    onGoToLibraryHub()
                  }}
                >
                  Bookshelf
                </button>
              </>
            : null}
            {cloudSyncConfigured && userEmail ?
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  close()
                  onSyncNow()
                }}
              >
                Sync library now
              </button>
            : null}
            {cloudSyncConfigured && userEmail ?
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  close()
                  void onSignOutCloud()
                }}
              >
                Sign out of cloud only
              </button>
            : null}
            <button
              type="button"
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-dust/30 dark:text-red-300 dark:hover:bg-border-dark/50"
              onClick={() => {
                close()
                onAppSignOut()
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      : null}
    </div>
  )
}
