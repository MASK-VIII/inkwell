import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useRef } from 'react'
import { InkwellEmblem } from './InkwellEmblem'
import { InkwellProfileMenu, type InkwellProfileMenuProps } from './InkwellProfileMenu'
import { InkwellWordmark } from './InkwellWordmark'
import { useThemeShine } from './useThemeShine'
import type { LibrarySyncStatus } from '../lib/sync/useInkwellLibrarySync'
import type { InkwellTier } from '../lib/inkwellEntitlements'

export type AccountScreenProps = {
  darkMode: boolean
  onToggleTheme: () => void
  onBackToBookshelf: () => void
  profileMenu: InkwellProfileMenuProps
  userEmail: string | null
  cloudSyncConfigured: boolean
  syncStatus: LibrarySyncStatus
  syncStatusDetail: string
  queueHasWork: boolean
  hasSyncConflict: boolean
  onSyncNow: () => void
  onSignOutCloud: () => void | Promise<void>
  onAppSignOut: () => void
  onOpenCloudSignIn: () => void
  /** When cloud sync is configured, show plan + upgrade actions. */
  licensing?: {
    loading: boolean
    tier: InkwellTier
    canUseCloudSync: boolean
    onUnlockEbookSuite: () => void
    onGoPro: () => void
    onUpgradeEbookToPro: () => void
  }
}

function tierLabel(tier: InkwellTier): string {
  switch (tier) {
    case 'ebook_suite':
      return 'Basic'
    case 'pro':
      return 'Pro'
    case 'free':
    default:
      return 'Free'
  }
}

function syncStatusLabel(status: LibrarySyncStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'syncing':
      return 'Syncing'
    case 'error':
      return 'Error'
    case 'offline':
      return 'Offline'
    case 'conflict':
      return 'Conflict'
    default:
      return status
  }
}

export function AccountScreen({
  darkMode,
  onToggleTheme,
  onBackToBookshelf,
  profileMenu,
  userEmail,
  cloudSyncConfigured,
  syncStatus,
  syncStatusDetail,
  queueHasWork,
  hasSyncConflict,
  onSyncNow,
  onSignOutCloud,
  onAppSignOut,
  onOpenCloudSignIn,
  licensing,
}: AccountScreenProps) {
  const brandRef = useRef<HTMLButtonElement>(null)
  useThemeShine(brandRef)

  const signedIntoCloud = Boolean(userEmail)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-parchment text-ink transition-colors dark:bg-panel-dark dark:text-ink-dark">
      <header className="inkwell-chrome-header sticky top-0 z-50 border-b border-dust bg-white/90 backdrop-blur-md dark:border-border-dark dark:bg-panel-dark/90">
        <div className="flex w-full min-h-[3.25rem] items-stretch sm:min-h-[3.5rem]">
          <div className="inkwell-theme-bridge flex min-w-0 flex-1 items-center justify-start gap-2 bg-white/70 py-2 pl-3 sm:gap-3 sm:py-3 sm:pl-5 dark:bg-panel-dark/70">
            <button
              type="button"
              onClick={onBackToBookshelf}
              className="inkwell-btn-icon shrink-0"
              aria-label="Back to Bookshelf"
              title="Back to Bookshelf"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              ref={brandRef}
              type="button"
              onClick={onBackToBookshelf}
              className="inkwell-header-brand group inline-flex w-fit max-w-full min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark sm:gap-3"
              aria-label="Inkwell — Bookshelf"
              title="Bookshelf"
            >
              <InkwellEmblem darkMode={darkMode} />
              <InkwellWordmark className="hidden min-w-0 sm:block" />
            </button>
          </div>

          <div className="flex min-h-[3.25rem] shrink-0 flex-col items-center justify-center px-3 py-2 sm:min-h-[3.5rem] sm:px-4 sm:py-3">
            <h1 className="truncate px-2 text-center font-serif text-lg font-semibold tracking-tight text-ink dark:text-ink-dark sm:text-xl">
              Account
            </h1>
          </div>

          <div className="relative z-10 flex min-w-0 flex-1 items-center justify-end gap-2 py-2 pl-2 pr-3 sm:py-3 sm:pr-5">
            <InkwellProfileMenu {...profileMenu} />
            <button
              type="button"
              onClick={onToggleTheme}
              className="inkwell-btn-icon"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <section className="rounded-2xl border border-dust/80 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-panel-dark/70">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Sign-in
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-ink/55 dark:text-ink-dark/55">Email</dt>
              <dd className="mt-0.5 font-medium text-ink dark:text-ink-dark">
                {signedIntoCloud ? userEmail : 'Not signed in to cloud sync'}
              </dd>
            </div>
            <div>
              <dt className="text-ink/55 dark:text-ink-dark/55">This device</dt>
              <dd className="mt-0.5 text-ink/90 dark:text-ink-dark/90">
                Your library is stored locally in this browser unless you export it.
              </dd>
            </div>
          </dl>
        </section>

        {cloudSyncConfigured && licensing ?
          <section className="rounded-2xl border border-dust/80 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-panel-dark/70">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Your plan
            </h2>
            <p className="mt-3 text-sm text-ink/80 dark:text-ink-dark/80">
              {licensing.loading ?
                'Loading license…'
              : <>
                  <span className="font-semibold text-ink dark:text-ink-dark">{tierLabel(licensing.tier)}</span>
                  {licensing.tier === 'free' ?
                    <span className="text-ink/65 dark:text-ink-dark/65">
                      {' '}
                      — Local-only storage on this device. Upgrade to Basic for cloud backup and EPUB, or Pro for the full
                      export suite.
                    </span>
                  : licensing.tier === 'ebook_suite' ?
                    <span className="text-ink/65 dark:text-ink-dark/65">
                      {' '}
                      — Cloud library sync and EPUB export included. Go Pro for print PDFs and the full export suite.
                    </span>
                  : (
                    <span className="text-ink/65 dark:text-ink-dark/65">
                      {' '}
                      — Full export suite and cloud library sync.
                    </span>
                  )}
                </>
              }
            </p>
            {!licensing.loading && licensing.tier !== 'pro' ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {licensing.tier === 'free' ? (
                  <button
                    type="button"
                    onClick={licensing.onUnlockEbookSuite}
                    className="inkwell-hub-secondary w-full sm:w-auto sm:min-w-[10rem]"
                  >
                    Unlock Basic ($49.99)
                  </button>
                ) : null}
                {licensing.tier === 'ebook_suite' ? (
                  <button
                    type="button"
                    onClick={licensing.onUpgradeEbookToPro}
                    className="inkwell-hub-secondary w-full sm:w-auto sm:min-w-[10rem]"
                  >
                    Upgrade to Pro ($99.99)
                  </button>
                ) : null}
                {licensing.tier === 'free' ? (
                  <button
                    type="button"
                    onClick={licensing.onGoPro}
                    className="inkwell-hub-primary w-full sm:w-auto sm:min-w-[10rem]"
                  >
                    Go Pro ($149.99)
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        : null}

        {cloudSyncConfigured ?
          <section className="rounded-2xl border border-dust/80 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-panel-dark/70">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Cloud library sync
            </h2>
            {!licensing?.loading && licensing && !licensing.canUseCloudSync ?
              <p className="mt-3 text-sm text-ink/70 dark:text-ink-dark/70">
                Cloud library sync unlocks with{' '}
                <span className="font-medium text-ink dark:text-ink-dark">Inkwell Basic</span> or{' '}
                <span className="font-medium text-ink dark:text-ink-dark">Pro</span>. On the Free plan your library is
                local-only on this device until you upgrade or use local exports.
              </p>
            : null}
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-ink/55 dark:text-ink-dark/55">Status</dt>
                <dd className="mt-0.5 font-medium capitalize text-ink dark:text-ink-dark">
                  {syncStatusLabel(syncStatus)}
                  {syncStatusDetail ?
                    <span className="mt-1 block text-xs font-normal text-ink/65 dark:text-ink-dark/65">
                      {syncStatusDetail}
                    </span>
                  : null}
                </dd>
              </div>
              <div>
                <dt className="text-ink/55 dark:text-ink-dark/55">Pending upload</dt>
                <dd className="mt-0.5 text-ink dark:text-ink-dark">{queueHasWork ? 'Yes' : 'No'}</dd>
              </div>
              {hasSyncConflict ?
                <div
                  role="alert"
                  className="rounded-xl border border-amber-400/70 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  Your library and the cloud copy disagree. Use the sync conflict dialog when it appears, or try Sync
                  now after reviewing both sides.
                </div>
              : null}
            </dl>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {!signedIntoCloud ?
                <button
                  type="button"
                  onClick={onOpenCloudSignIn}
                  className="inkwell-hub-primary w-full sm:w-auto sm:min-w-[10rem]"
                >
                  Open cloud sign-in
                </button>
              : null}
              <button
                type="button"
                onClick={onSyncNow}
                disabled={
                  !signedIntoCloud ||
                  Boolean(licensing && !licensing.loading && !licensing.canUseCloudSync)
                }
                title={
                  licensing && !licensing.loading && !licensing.canUseCloudSync ?
                    'Upgrade to Basic or Pro to sync your library to the cloud.'
                  : undefined
                }
                className="inkwell-hub-secondary w-full sm:w-auto sm:min-w-[10rem] disabled:pointer-events-none disabled:opacity-40"
              >
                Sync library now
              </button>
              {signedIntoCloud ?
                <button
                  type="button"
                  onClick={() => void onSignOutCloud()}
                  className="w-full rounded-2xl border border-dust bg-transparent px-4 py-3 text-sm font-semibold text-ink outline-none transition-colors hover:bg-dust/25 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/40 sm:w-auto"
                >
                  Sign out of cloud only
                </button>
              : null}
            </div>
          </section>
        : (
          <section className="rounded-2xl border border-dust/60 bg-white/60 p-5 text-sm text-ink/75 dark:border-border-dark dark:bg-panel-dark/50 dark:text-ink-dark/75">
            Cloud sync is not enabled in this build.
          </section>
        )}

        <section className="rounded-2xl border border-dust/80 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-panel-dark/70">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Session
          </h2>
          <p className="mt-3 text-sm text-ink/75 dark:text-ink-dark/75">
            Signing out removes your session on this device. Your local manuscripts remain until you delete them or clear
            site data.
          </p>
          <button
            type="button"
            onClick={onAppSignOut}
            className="mt-4 w-full rounded-2xl bg-red-600/95 px-4 py-3 text-sm font-semibold text-white outline-none transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-red-700 dark:hover:bg-red-600 dark:focus-visible:ring-offset-panel-dark sm:w-auto"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  )
}
