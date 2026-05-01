import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { BookMeta, WritingGoals } from '../types'

type Props = {
  open: boolean
  onClose: () => void
  book: BookMeta
  onBookChange: (patch: Partial<BookMeta>) => void
  goals: WritingGoals
  onGoalsChange: (patch: Partial<WritingGoals>) => void
  totalBookWords: number
  wordsWrittenToday: number
}

function ProgressBar({
  label,
  current,
  target,
}: {
  label: string
  current: number
  target: number
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-walnut/90 dark:text-accent-warm/90">
        <span>{label}</span>
        <span>
          {current.toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-dust/60 dark:bg-border-dark/80">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-300 dark:bg-cream"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function BookTools({
  open,
  onClose,
  book,
  onBookChange,
  goals,
  onGoalsChange,
  totalBookWords,
  wordsWrittenToday,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Close book tools"
        className="fixed inset-0 z-[100] bg-ink/20 backdrop-blur-[2px] dark:bg-black/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-tools-title"
        className="fixed right-0 top-0 z-[101] flex h-full w-full max-w-md flex-col border-l border-dust bg-white shadow-2xl dark:border-border-dark dark:bg-panel-dark"
      >
        <div className="flex items-center justify-between border-b border-dust px-6 py-4 dark:border-border-dark">
          <h2 id="book-tools-title" className="font-serif text-xl font-semibold text-ink dark:text-ink-dark">
            Book tools
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-ink hover:bg-dust/40 dark:text-ink-dark dark:hover:bg-border-dark/50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-10">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Book details
            </h3>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Title</span>
                <input
                  type="text"
                  value={book.title}
                  onChange={(e) => onBookChange({ title: e.target.value })}
                  placeholder="Working title"
                  className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Subtitle</span>
                <input
                  type="text"
                  value={book.subtitle}
                  onChange={(e) => onBookChange({ subtitle: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Author</span>
                <input
                  type="text"
                  value={book.authorName}
                  onChange={(e) => onBookChange({ authorName: e.target.value })}
                  placeholder="Your name"
                  className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Series</span>
                <input
                  type="text"
                  value={book.series}
                  onChange={(e) => onBookChange({ series: e.target.value })}
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Goals & stats
            </h3>
            <div className="rounded-2xl border border-dust bg-parchment/80 p-4 dark:border-border-dark dark:bg-panel-dark/80">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-walnut dark:text-accent-warm">Book words</dt>
                  <dd className="font-semibold tabular-nums text-ink dark:text-ink-dark">
                    {totalBookWords.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-walnut dark:text-accent-warm">Today</dt>
                  <dd className="font-semibold tabular-nums text-ink dark:text-ink-dark">
                    {wordsWrittenToday.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">
                  Manuscript target (words)
                </span>
                <input
                  type="number"
                  min={0}
                  value={goals.manuscriptTargetWords ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    onGoalsChange({
                      manuscriptTargetWords: raw === '' ? null : Math.max(0, Number(raw) || 0),
                    })
                  }}
                  placeholder="e.g. 80000"
                  className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">
                  Daily word goal
                </span>
                <input
                  type="number"
                  min={0}
                  value={goals.dailyWordGoal ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    onGoalsChange({
                      dailyWordGoal: raw === '' ? null : Math.max(0, Number(raw) || 0),
                    })
                  }}
                  placeholder="e.g. 1000"
                  className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                />
              </label>
            </div>

            {goals.manuscriptTargetWords != null && goals.manuscriptTargetWords > 0 && (
              <ProgressBar
                label="Toward manuscript target"
                current={totalBookWords}
                target={goals.manuscriptTargetWords}
              />
            )}
            {goals.dailyWordGoal != null && goals.dailyWordGoal > 0 && (
              <ProgressBar
                label="Today's progress"
                current={wordsWrittenToday}
                target={goals.dailyWordGoal}
              />
            )}
          </section>

          <section className="rounded-2xl border border-dashed border-dust p-4 text-sm text-ink/55 dark:border-border-dark dark:text-ink-dark/55">
            <p className="font-medium text-ink/70 dark:text-ink-dark/70">Coming next</p>
            <p className="mt-1">
              Outline, find & replace, front matter, notes, and export options will live here as they ship.
            </p>
          </section>
        </div>
      </aside>
    </>
  )
}
