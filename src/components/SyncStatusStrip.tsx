import { Cloud, CloudOff, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import type { LibrarySyncStatus } from '../lib/sync/useInkwellLibrarySync'

type Props = {
  status: LibrarySyncStatus
  detail?: string
  signedIn: boolean
  onSyncNow?: () => void
}

export function SyncStatusStrip({ status, detail, signedIn, onSyncNow }: Props) {
  if (!signedIn) return null

  const icon =
    status === 'offline' ? <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
    : status === 'syncing' ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
    : status === 'error' ? <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
    : status === 'conflict' ? <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
    : <Cloud className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />

  const label =
    status === 'offline' ? 'Offline'
    : status === 'syncing' ? 'Syncing'
    : status === 'error' ? 'Sync error'
    : status === 'conflict' ? 'Conflict'
    : 'Cloud sync'

  const tone =
    status === 'error' ? 'text-red-800 dark:text-red-200'
    : status === 'conflict' ? 'text-amber-900 dark:text-amber-100'
    : status === 'offline' ? 'text-ink/70 dark:text-ink-dark/70'
    : 'text-ink/80 dark:text-ink-dark/80'

  return (
    <div
      className={`flex w-full items-center justify-center gap-2 border-b border-dust/80 bg-dust/15 px-3 py-1.5 text-[11px] dark:border-border-dark/80 dark:bg-border-dark/25 sm:text-xs ${tone}`}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span className="font-medium">{label}</span>
      {detail ? <span className="truncate opacity-90">— {detail}</span> : null}
      {onSyncNow && status !== 'syncing' && status !== 'conflict' ? (
        <button
          type="button"
          onClick={onSyncNow}
          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 font-medium text-ink underline decoration-dotted underline-offset-2 hover:bg-white/60 dark:text-ink-dark dark:hover:bg-panel-dark/80"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Sync now
        </button>
      ) : null}
    </div>
  )
}
