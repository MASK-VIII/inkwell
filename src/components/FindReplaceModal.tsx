import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Manuscript } from '../types'
import { countOccurrencesInProject, replaceInAllChapters } from '../lib/findReplace'

type Props = {
  open: boolean
  onClose: () => void
  chapters: Manuscript[]
  onApply: (next: Manuscript[]) => void
}

export function FindReplaceModal({ open, onClose, chapters, onApply }: Props) {
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const matches = useMemo(
    () => countOccurrencesInProject(chapters, find, caseSensitive),
    [chapters, find, caseSensitive],
  )

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close find and replace"
        className="fixed inset-0 z-[200] bg-ink/25 backdrop-blur-[1px] dark:bg-black/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="find-replace-title"
        className="fixed left-1/2 top-24 z-[201] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-dust bg-panel-light-strong p-5 shadow-2xl dark:border-border-dark dark:bg-panel-dark"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="find-replace-title" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
            Find & replace
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink hover:bg-dust/40 dark:text-ink-dark dark:hover:bg-border-dark/50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-xs text-ink/65 dark:text-ink-dark/65">
          Runs across all sections in this project. Undo via history if needed.
        </p>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Find</span>
            <input
              type="text"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              className="w-full rounded-xl border border-dust bg-parchment px-3 py-2 text-sm dark:border-border-dark dark:bg-panel-dark"
              autoFocus
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Replace with</span>
            <input
              type="text"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              className="w-full rounded-xl border border-dust bg-parchment px-3 py-2 text-sm dark:border-border-dark dark:bg-panel-dark"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink dark:text-ink-dark">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            Case sensitive
          </label>
        </div>
        <p className="mt-3 text-xs tabular-nums text-walnut dark:text-accent-warm">
          {find.trim() ? `${matches} match${matches === 1 ? '' : 'es'}` : '—'}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-dust px-4 py-2 text-sm font-semibold dark:border-border-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!find}
            onClick={() => {
              onApply(replaceInAllChapters(chapters, find, replace, caseSensitive))
              onClose()
            }}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-parchment disabled:opacity-40 dark:bg-cream dark:text-ink"
          >
            Replace all
          </button>
        </div>
      </div>
    </>
  )
}
