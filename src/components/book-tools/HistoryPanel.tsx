import { useState } from 'react'
import type { ProjectHistoryEntry } from '../../lib/manuscripts'

type Props = {
  projectId: string
  historyEntries: ProjectHistoryEntry[]
  onRestoreHistory: (snapshotId: string) => void
  onClearHistory: () => void
}

export function HistoryPanel({ projectId, historyEntries, onRestoreHistory, onClearHistory }: Props) {
  const [showAllHistory, setShowAllHistory] = useState(false)
  const historyToShow = (showAllHistory ? historyEntries : historyEntries.slice(0, 12)).filter(Boolean)

  return (
    <div className="rounded-2xl border border-dust bg-parchment/80 p-4 dark:border-border-dark dark:bg-panel-dark/80 space-y-3">
      <div className="text-xs text-ink/60 dark:text-ink-dark/60">
        Inkwell keeps local recovery snapshots for this book (<span className="font-mono">{projectId}</span>).
      </div>

      {historyEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-dust bg-panel-light-muted/65 p-4 text-sm text-ink-muted dark:border-border-dark dark:bg-panel-dark/40 dark:text-ink-dark/60">
          No snapshots yet. Keep writing—snapshots appear automatically.
        </div>
      ) : (
        <div className="space-y-2">
          {historyToShow.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onRestoreHistory(h.id)}
              className="w-full rounded-2xl border border-dust bg-panel-light/88 px-4 py-3 text-left text-sm transition-colors hover:bg-panel-light-strong dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90"
              title={`Restore snapshot (${new Date(h.ts).toLocaleString()})`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-ink dark:text-ink-dark">{h.label}</div>
                  <div className="mt-0.5 text-xs text-ink/55 dark:text-ink-dark/55">
                    {new Date(h.ts).toLocaleString()}
                  </div>
                </div>
                <div className="shrink-0 rounded-2xl bg-dust/40 px-2 py-1 text-[11px] font-semibold text-walnut dark:bg-border-dark/60 dark:text-accent-warm">
                  {(h.bytes / 1024).toFixed(0)} KB
                </div>
              </div>
            </button>
          ))}

          {historyEntries.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAllHistory((v) => !v)}
              className="w-full rounded-2xl border border-dust bg-panel-light-muted/68 px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-panel-light-strong dark:border-border-dark dark:bg-panel-dark/40 dark:text-ink-dark/80 dark:hover:bg-panel-dark/70"
            >
              {showAllHistory ? 'Show fewer' : `Show all (${historyEntries.length})`}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const ok = window.confirm(
                'Clear local recovery history for this book? This cannot be undone.',
              )
              if (!ok) return
              onClearHistory()
            }}
            className="w-full rounded-2xl border border-red-200 bg-red-50/60 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            Clear recovery history
          </button>
        </div>
      )}

      <div className="text-xs text-ink/55 dark:text-ink-dark/55">
        Tip: Restoring a snapshot will replace the current book state. Inkwell will automatically snapshot your
        current state first.
      </div>
    </div>
  )
}
