import { AlertCircle, CheckCircle2, Cloud, CloudOff, Loader2 } from 'lucide-react'
import type { LibrarySyncStatus } from '../lib/sync/useInkwellLibrarySync'

type Props = {
  status: LibrarySyncStatus
  detail?: string
  signedIn: boolean
  queueHasWork: boolean
}

export function SyncStatusStrip({ status, detail, signedIn, queueHasWork }: Props) {
  if (!signedIn) return null

  if (status === 'idle' && !queueHasWork) {
    return (
      <div
        className="flex w-full items-center justify-center gap-2 border-b border-dust/80 bg-dust/15 px-3 py-1.5 text-[11px] text-emerald-700 dark:border-border-dark/80 dark:bg-border-dark/25 dark:text-emerald-400 sm:text-xs"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span className="font-medium">Synced</span>
        {detail ? <span className="truncate opacity-90">— {detail}</span> : null}
      </div>
    )
  }

  if (status === 'idle' && queueHasWork) {
    const pendingDetail = detail?.trim() ? detail : 'Queued…'
    return (
      <div
        className="flex w-full items-center justify-center gap-2 border-b border-dust/80 bg-dust/15 px-3 py-1.5 text-[11px] text-ink/80 dark:border-border-dark/80 dark:bg-border-dark/25 dark:text-ink-dark/80 sm:text-xs"
        role="status"
        aria-live="polite"
      >
        <Cloud className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="font-medium">Cloud sync</span>
        <span className="truncate opacity-90">— {pendingDetail}</span>
      </div>
    )
  }

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
    </div>
  )
}
