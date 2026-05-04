import { AlertTriangle } from 'lucide-react'

type Props = {
  open: boolean
  serverRev: string
  busy?: boolean
  onKeepLocal: () => void
  onUseCloud: () => void
  onExportBoth: () => void
}

export function SyncConflictModal({
  open,
  serverRev,
  busy,
  onKeepLocal,
  onUseCloud,
  onExportBoth,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm dark:bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-conflict-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-dust bg-white p-6 shadow-2xl dark:border-border-dark dark:bg-panel-dark">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 id="sync-conflict-title" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
              Library sync conflict
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/75 dark:text-ink-dark/75">
              The cloud copy was updated elsewhere (revision <span className="font-mono text-xs">{serverRev}</span>).
              Choose how to proceed — Inkwell does not auto-merge full libraries.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onKeepLocal}
            className="rounded-xl bg-ink px-4 py-3 text-left text-sm font-semibold text-parchment transition-opacity hover:opacity-95 disabled:opacity-50 dark:bg-cream dark:text-ink"
          >
            Keep this device
            <span className="mt-0.5 block text-xs font-normal opacity-90">Upload your local library and advance the cloud revision (overwrites cloud snapshot).</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onUseCloud}
            className="rounded-xl border border-dust bg-white px-4 py-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-dust/20 disabled:opacity-50 dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:hover:bg-border-dark/40"
          >
            Use cloud copy
            <span className="mt-0.5 block text-xs font-normal opacity-80">Replace this device’s library with the latest from the cloud.</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onExportBoth}
            className="rounded-xl border border-dust px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:bg-dust/15 disabled:opacity-50 dark:border-border-dark dark:text-ink-dark dark:hover:bg-border-dark/30"
          >
            Download both as .zip
            <span className="mt-0.5 block text-xs font-normal text-ink/65 dark:text-ink-dark/65">Save local and cloud snapshots for manual comparison.</span>
          </button>
        </div>
      </div>
    </div>
  )
}
