import { X } from 'lucide-react'
import type { InkwellEntitlementStatus } from '../hooks/useInkwellEntitlements'
import type { InkwellTier } from '../lib/inkwellEntitlements'

type PaidFeatureGateMode = 'blocked' | 'offline_cached'

export type PaidFeatureGateModalState = {
  requiredTier: Extract<InkwellTier, 'basic' | 'pro'>
  mode?: PaidFeatureGateMode
}

type Props = {
  open: boolean
  state: PaidFeatureGateModalState | null
  entitlement: {
    tier: InkwellTier
    status: InkwellEntitlementStatus
    isOffline: boolean
    userId: string | null
    loading: boolean
  }
  onClose: () => void
  onSignIn: () => void
  onUpgrade: () => void
  onSignOut: () => void
}

function isSignedIn(entitlement: Props['entitlement']): boolean {
  return Boolean(entitlement.userId)
}

export function PaidFeatureGateModal({
  open,
  state,
  entitlement,
  onClose,
  onSignIn,
  onUpgrade,
  onSignOut,
}: Props) {
  if (!open || !state) return null

  const signedIn = isSignedIn(entitlement)
  const offline = entitlement.isOffline
  const offlineCached = state.mode === 'offline_cached'
  const loading = entitlement.loading || entitlement.status === 'loading'
  const signedInFree = signedIn && entitlement.status === 'verified' && entitlement.tier === 'free'

  const content =
    offlineCached ?
      {
        title: 'You’re offline',
        body: 'You can keep writing. Basic/Pro features are available on this device. We’ll re-check your plan next time you’re online.',
        primary: null,
        secondary: 'Not now',
        small: null,
      }
    : loading ?
      {
        title: 'Checking plan…',
        body: 'Checking plan…',
        primary: null,
        secondary: 'Not now',
        small: null,
      }
    : signedInFree ?
      {
        title: 'Basic/Pro isn’t active on this account',
        body: 'You’re signed in, but we couldn’t find an active Basic/Pro plan. Your Free library is still available.',
        primary: 'Upgrade',
        secondary: 'Sign out',
        small: null,
      }
    : offline ?
      {
        title: 'Sign in to use Basic/Pro features',
        body: 'Your library is saved on this device and works offline. To unlock Basic/Pro features, sign in when you’re back online.',
        primary: 'Sign in',
        secondary: 'Not now',
        small: 'No account is required for Free.',
      }
    : {
        title: 'Unlock Basic/Pro',
        body: 'Sign in to unlock Basic/Pro features on this device. Your Free library stays available offline.',
        primary: 'Sign in',
        secondary: 'Continue on Free',
        small: null,
      }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paid-feature-gate-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-dust/80 bg-parchment p-6 shadow-xl dark:border-border-dark dark:bg-panel-dark">
        <button
          type="button"
          onClick={onClose}
          className="inkwell-btn-icon absolute right-3 top-3"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="paid-feature-gate-title" className="pr-10 font-serif text-xl font-semibold text-ink dark:text-ink-dark">
          {content.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/80 dark:text-ink-dark/80">{content.body}</p>
        {content.small ?
          <p className="mt-3 text-xs text-ink/60 dark:text-ink-dark/60">{content.small}</p>
        : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={signedInFree ? onSignOut : onClose}
            className="inkwell-hub-secondary w-full sm:w-auto"
          >
            {content.secondary}
          </button>
          {content.primary ?
            <button
              type="button"
              disabled={content.primary === 'Sign in' && offline}
              onClick={content.primary === 'Upgrade' ? onUpgrade : onSignIn}
              className="inkwell-hub-primary w-full disabled:pointer-events-none disabled:opacity-40 sm:w-auto"
            >
              {content.primary}
            </button>
          : null}
        </div>
      </div>
    </div>
  )
}
