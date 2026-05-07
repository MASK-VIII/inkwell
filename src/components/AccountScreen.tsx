import { ArrowLeft, Moon, PartyPopper, Sun, X } from 'lucide-react'
import { useRef } from 'react'
import { InkwellEmblem } from './InkwellEmblem'
import { InkwellProfileMenu, type InkwellProfileMenuProps } from './InkwellProfileMenu'
import { InkwellWordmark } from './InkwellWordmark'
import { useThemeShine } from './useThemeShine'
import type { LibrarySyncStatus } from '../lib/sync/useInkwellLibrarySync'
import type { InkwellTier } from '../lib/inkwellEntitlements'
import type { InkwellEntitlementStatus } from '../hooks/useInkwellEntitlements'
import { CLOUD_LIMIT_BASIC_DISPLAY, CLOUD_LIMIT_PRO_DISPLAY, formatCloudBytes } from '../lib/cloudQuota'
import {
  INKWELL_DISPLAY_PRICE_BASIC,
  INKWELL_DISPLAY_PRICE_BASIC_TO_PRO,
  INKWELL_DISPLAY_PRICE_PRO,
} from '../marketing/pricingCopy'

export type CloudBackupMeterProps = {
  loading: boolean
  /** Compressed library zip size (matches cloud quota). */
  zipBytes: number | null
  limitBytes: number
  estimateImageBytes: number
  estimateManuscriptBytes: number
}

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
    status: InkwellEntitlementStatus
    lastVerifiedAt?: string
    canUseCloudSync: boolean
    onUnlockEbookSuite: () => void
    onGoPro: () => void
    onUpgradeEbookToPro: () => void
  }
  /**
   * When set, shows a one-time celebration banner at the top of the Account screen after a Paddle
   * return. Displays the unlocked tier and a CTA back to the bookshelf. The parent owns dismissal.
   */
  purchaseConfirmation?: {
    tier: InkwellTier
    loading: boolean
    onOpenLibrary: () => void
    onDismiss: () => void
  }
  /** Basic/Pro: shows backup zip size vs tier limit. */
  cloudBackupMeter?: CloudBackupMeterProps | null
}

function tierLabel(tier: InkwellTier): string {
  switch (tier) {
    case 'basic':
      return 'Basic'
    case 'pro':
      return 'Pro'
    case 'free':
    default:
      return 'Free'
  }
}

function offlineReadyTierLabel(tier: InkwellTier): string {
  const label = tierLabel(tier)
  return tier === 'basic' || tier === 'pro' ? `${label} (offline-ready)` : label
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

function purchaseCelebrationCopy(tier: InkwellTier, loading: boolean) {
  if (loading || tier === 'free') {
    return {
      title: 'Confirming your purchase\u2026',
      body: 'Paddle just sent us your payment. We are unlocking your account now \u2014 it usually takes a few seconds. Refresh if it does not update shortly.',
    }
  }
  if (tier === 'basic') {
    return {
      title: 'You unlocked Inkwell Basic',
      body: `Cloud library sync (${CLOUD_LIMIT_BASIC_DISPLAY} compressed backup) and EPUB export are live on this account. Welcome aboard.`,
    }
  }
  return {
    title: 'You unlocked Inkwell Pro',
    body: `The full export suite, advanced formatting, and cloud backup up to ${CLOUD_LIMIT_PRO_DISPLAY} are live on this account—the same lifetime updates as Basic. Welcome aboard.`,
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
  purchaseConfirmation,
  cloudBackupMeter,
}: AccountScreenProps) {
  const brandRef = useRef<HTMLButtonElement>(null)
  useThemeShine(brandRef)

  const signedIntoCloud = Boolean(userEmail)
  const headerExit = onBackToBookshelf
  const headerExitLabel = 'Back to Bookshelf'
  const brandTitle = 'Bookshelf'

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-parchment text-ink transition-colors dark:bg-panel-dark dark:text-ink-dark">
      <header className="inkwell-chrome-header sticky top-0 z-50 border-b border-dust bg-white/90 backdrop-blur-md dark:border-border-dark dark:bg-panel-dark/90">
        <div className="flex w-full min-h-[3.25rem] items-stretch sm:min-h-[3.5rem]">
          <div className="inkwell-theme-bridge flex min-w-0 flex-1 items-center justify-start gap-2 bg-white/70 py-2 pl-3 sm:gap-3 sm:py-3 sm:pl-5 dark:bg-panel-dark/70">
            <button
              type="button"
              onClick={headerExit}
              className="inkwell-btn-icon shrink-0"
              aria-label={headerExitLabel}
              title={headerExitLabel}
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              ref={brandRef}
              type="button"
              onClick={headerExit}
              className="inkwell-header-brand group inline-flex w-fit max-w-full min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark sm:gap-3"
              aria-label={brandTitle}
              title={brandTitle}
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
        {purchaseConfirmation ? (() => {
          const copy = purchaseCelebrationCopy(purchaseConfirmation.tier, purchaseConfirmation.loading)
          return (
            <section
              role="status"
              aria-live="polite"
              className="relative overflow-hidden rounded-2xl border border-walnut/35 bg-gradient-to-br from-parchment to-parchment/70 p-5 shadow-sm dark:border-accent-warm/45 dark:from-panel-dark dark:to-panel-dark/70"
            >
              <button
                type="button"
                onClick={purchaseConfirmation.onDismiss}
                aria-label="Dismiss"
                title="Dismiss"
                className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-walnut/70 transition hover:bg-walnut/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 dark:text-ink-dark/65 dark:hover:bg-accent-warm/15 dark:hover:text-ink-dark"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-walnut/15 text-walnut dark:bg-accent-warm/20 dark:text-accent-warm"
                >
                  <PartyPopper className="h-5 w-5" />
                </span>
                <div className="min-w-0 pr-6">
                  <h2 className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
                    {copy.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/80 dark:text-ink-dark/80">
                    {copy.body}
                  </p>
                  {userEmail ?
                    <p className="mt-2 text-xs text-ink/55 dark:text-ink-dark/55">
                      Receipt sent to {userEmail}.
                    </p>
                  : null}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={purchaseConfirmation.onOpenLibrary}
                      className="inkwell-hub-primary inline-flex w-full items-center justify-center sm:w-auto sm:min-w-[12rem]"
                    >
                      Open your library
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )
        })() : null}

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
                'Checking plan…'
              : <>
                  <span className="font-semibold text-ink dark:text-ink-dark">
                    {offlineReadyTierLabel(licensing.tier)}
                  </span>
                  {licensing.tier === 'free' ?
                    <span className="text-ink/65 dark:text-ink-dark/65">
                      {' '}
                      — Local-only storage on this device. Upgrade to Basic for cloud backup and EPUB, or Pro for the full
                      export suite.
                    </span>
                  : licensing.tier === 'basic' ?
                    <span className="text-ink/65 dark:text-ink-dark/65">
                      {' '}
                      — Cloud backup up to {CLOUD_LIMIT_BASIC_DISPLAY} and EPUB export included. Go Pro for print PDFs,
                      higher backup space ({CLOUD_LIMIT_PRO_DISPLAY}), and the full export suite.
                    </span>
                  : (
                    <span className="text-ink/65 dark:text-ink-dark/65">
                      {' '}
                      — Full export suite and cloud backup up to {CLOUD_LIMIT_PRO_DISPLAY}.
                    </span>
                  )}
                </>
              }
            </p>
            {!licensing.loading && (licensing.tier === 'basic' || licensing.tier === 'pro') ?
              <div className="mt-3 rounded-xl border border-dust/70 bg-white/55 px-3 py-2 text-xs leading-relaxed text-ink/65 dark:border-border-dark dark:bg-panel-dark/55 dark:text-ink-dark/65">
                {licensing.status === 'offline_cached' ?
                  <>
                    <p className="font-semibold text-ink dark:text-ink-dark">You’re offline</p>
                    <p className="mt-1">
                      You can keep writing. Basic/Pro features are available on this device. We’ll re-check your plan
                      next time you’re online.
                    </p>
                  </>
                : <p>Verified on this device.</p>}
              </div>
            : null}
            {!licensing.loading && licensing.tier !== 'pro' ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {licensing.tier === 'free' ? (
                  <button
                    type="button"
                    onClick={licensing.onUnlockEbookSuite}
                    className="inkwell-hub-secondary w-full sm:w-auto sm:min-w-[10rem]"
                  >
                    Unlock Basic ({INKWELL_DISPLAY_PRICE_BASIC})
                  </button>
                ) : null}
                {licensing.tier === 'basic' ? (
                  <button
                    type="button"
                    onClick={licensing.onUpgradeEbookToPro}
                    className="inkwell-hub-secondary w-full sm:w-auto sm:min-w-[10rem]"
                  >
                    Upgrade to Pro ({INKWELL_DISPLAY_PRICE_BASIC_TO_PRO})
                  </button>
                ) : null}
                {licensing.tier === 'free' ? (
                  <button
                    type="button"
                    onClick={licensing.onGoPro}
                    className="inkwell-hub-primary w-full sm:w-auto sm:min-w-[10rem]"
                  >
                    Go Pro ({INKWELL_DISPLAY_PRICE_PRO})
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        : null}

        <section className="rounded-2xl border border-dust/80 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-panel-dark/70">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
            Using Inkwell on a new device?
          </h2>
          <p className="mt-3 text-sm text-ink/75 dark:text-ink-dark/75">
            Sign in to restore Basic/Pro on this device. Free libraries are stored per-device.
          </p>
        </section>

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
            {licensing?.canUseCloudSync && cloudBackupMeter ?
              <div
                className={[
                  'mt-4 rounded-xl border px-3 py-3',
                  !cloudBackupMeter.loading &&
                    cloudBackupMeter.zipBytes != null &&
                    cloudBackupMeter.zipBytes / cloudBackupMeter.limitBytes >= 0.9 ?
                    'border-amber-500/60 bg-amber-50/80 dark:border-amber-600/45 dark:bg-amber-950/35'
                  : 'border-dust/70 bg-white/55 dark:border-border-dark dark:bg-panel-dark/55',
                ].join(' ')}
              >
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-walnut/85 dark:text-accent-warm/90">
                  Cloud backup size
                </h3>
                {cloudBackupMeter.loading ?
                  <p className="mt-2 text-sm text-ink/70 dark:text-ink-dark/70">Measuring backup…</p>
                : cloudBackupMeter.zipBytes != null ?
                  <>
                    <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-ink dark:text-ink-dark">
                        {formatCloudBytes(cloudBackupMeter.zipBytes)} /{' '}
                        {formatCloudBytes(cloudBackupMeter.limitBytes)}
                      </span>
                      <span className="text-xs text-ink/55 dark:text-ink-dark/55">Compressed backup</span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-dust/50 dark:bg-border-dark/80"
                      role="progressbar"
                      aria-valuenow={Math.round(
                        Math.min(100, (cloudBackupMeter.zipBytes / cloudBackupMeter.limitBytes) * 100),
                      )}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Cloud backup usage"
                    >
                      <div
                        className="h-full rounded-full bg-walnut/70 transition-[width] dark:bg-accent-warm/80"
                        style={{
                          width: `${Math.min(100, (cloudBackupMeter.zipBytes / cloudBackupMeter.limitBytes) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink/60 dark:text-ink-dark/60">
                      Approx. in your library before compression: images ~{' '}
                      {formatCloudBytes(cloudBackupMeter.estimateImageBytes)}, manuscripts &amp; metadata ~{' '}
                      {formatCloudBytes(cloudBackupMeter.estimateManuscriptBytes)}. Totals are estimates; the bar uses
                      your real backup file size.
                    </p>
                  </>
                : (
                  <p className="mt-2 text-sm text-ink/70 dark:text-ink-dark/70">
                    Could not measure backup size. Try again after syncing.
                  </p>
                )}
              </div>
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
                disabled={!signedIntoCloud}
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
