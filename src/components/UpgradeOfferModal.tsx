import { X } from 'lucide-react'
import {
  INKWELL_DISPLAY_PRICE_BASIC,
  INKWELL_DISPLAY_PRICE_BASIC_TO_PRO,
  INKWELL_DISPLAY_PRICE_PRO,
} from '../marketing/pricingCopy'

export type UpgradeOfferIntent = 'basic' | 'pro' | 'upgrade'

type Props = {
  open: boolean
  intent: UpgradeOfferIntent
  onClose: () => void
  onContinue: () => void
  /** Fires on primary-button pointer down so Paddle.js can preload before click (helps overlay open on live). */
  onContinuePointerDown?: () => void
  /** False while Paddle.js is preloading for overlay-only checkout (avoids opening after `await`, which drops user activation). */
  continueReady?: boolean
}

function titleFor(intent: UpgradeOfferIntent): string {
  switch (intent) {
    case 'basic':
      return 'Upgrade to Basic'
    case 'upgrade':
      return 'Upgrade to Pro'
    case 'pro':
    default:
      return 'Upgrade to Pro'
  }
}

function bodyFor(intent: UpgradeOfferIntent): string {
  switch (intent) {
    case 'basic':
      return `Basic (${INKWELL_DISPLAY_PRICE_BASIC}) unlocks EPUB export and cloud library sync across your devices. Continue to secure checkout when you are ready.`
    case 'upgrade':
      return `Move from Basic to Pro for ${INKWELL_DISPLAY_PRICE_BASIC_TO_PRO} (one-time upgrade). Continue to checkout to complete your upgrade.`
    case 'pro':
    default:
      return `Pro (${INKWELL_DISPLAY_PRICE_PRO} early access) unlocks the full export suite (PDF, DOCX, archives, and more). Continue to secure checkout when you are ready.`
  }
}

export function UpgradeOfferModal({
  open,
  intent,
  onClose,
  onContinue,
  onContinuePointerDown,
  continueReady = true,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-offer-title"
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
        <h2 id="upgrade-offer-title" className="pr-10 font-serif text-xl font-semibold text-ink dark:text-ink-dark">
          {titleFor(intent)}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/80 dark:text-ink-dark/80">{bodyFor(intent)}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inkwell-hub-secondary w-full sm:w-auto">
            Not now
          </button>
          <button
            type="button"
            disabled={!continueReady}
            onPointerDown={(e) => {
              if (e.button !== 0 || !continueReady) return
              onContinuePointerDown?.()
            }}
            onClick={onContinue}
            className="inkwell-hub-primary w-full sm:w-auto disabled:cursor-wait disabled:opacity-60"
          >
            {continueReady ? 'Continue to checkout' : 'Preparing checkout…'}
          </button>
        </div>
      </div>
    </div>
  )
}
