import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onOpenSignIn: () => void
}

export function PurchaseSignInModal({ open, onClose, onOpenSignIn }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-signin-title"
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
        <h2 id="purchase-signin-title" className="pr-10 font-serif text-xl font-semibold text-ink dark:text-ink-dark">
          Sign in to purchase
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/80 dark:text-ink-dark/80">
          We attach your purchase to your Inkwell account so exports and cloud sync unlock automatically. Sign in to cloud
          sync first, then return here to upgrade.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inkwell-hub-secondary w-full sm:w-auto">
            Cancel
          </button>
          <button type="button" onClick={onOpenSignIn} className="inkwell-hub-primary w-full sm:w-auto">
            Open sign-in
          </button>
        </div>
      </div>
    </div>
  )
}
