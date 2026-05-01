import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { BookMeta, EbookTheme, PrintTheme, Theme, TrimPresetId, WritingGoals } from '../types'
import { TRIM_PRESETS } from '../types'
import type { ProjectHistoryEntry } from '../lib/manuscripts'

type Props = {
  open: boolean
  onClose: () => void
  projectId: string
  mode: 'write' | 'review_print' | 'review_ebook'
  onSetMode: (mode: 'write' | 'review_print' | 'review_ebook') => void
  book: BookMeta
  onBookChange: (patch: Partial<BookMeta>) => void
  goals: WritingGoals
  onGoalsChange: (patch: Partial<WritingGoals>) => void
  theme: Theme
  onThemeChange: (patch: { print?: Partial<PrintTheme>; ebook?: Partial<EbookTheme> }) => void
  totalBookWords: number
  wordsWrittenToday: number
  onOpenPrintReview: () => void
  onOpenEbookReview: () => void
  onExportPdfKdp: () => void
  onExportEpub: () => void
  onImportDocx: (file: File) => void
  historyEntries: ProjectHistoryEntry[]
  onRestoreHistory: (snapshotId: string) => void
  onClearHistory: () => void
}

function clampNumber(value: string, fallback: number, min?: number, max?: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const lo = min == null ? n : Math.max(min, n)
  return max == null ? lo : Math.min(max, lo)
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
  projectId,
  mode,
  onSetMode,
  book,
  onBookChange,
  goals,
  onGoalsChange,
  theme,
  onThemeChange,
  totalBookWords,
  wordsWrittenToday,
  onOpenPrintReview,
  onOpenEbookReview,
  onExportPdfKdp,
  onExportEpub,
  onImportDocx,
  historyEntries,
  onRestoreHistory,
  onClearHistory,
}: Props) {
  const [present, setPresent] = useState(open)
  const [phase, setPhase] = useState<'entering' | 'open' | 'closing'>(() =>
    open ? 'entering' : 'closing',
  )
  const [showAllHistory, setShowAllHistory] = useState(false)

  useEffect(() => {
    if (open) {
      // Mount hidden, then animate in next frame(s).
      queueMicrotask(() => {
        setPresent(true)
        setPhase('entering')
      })
      let raf1 = 0
      let raf2 = 0
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setPhase('open'))
      })
      return () => {
        window.cancelAnimationFrame(raf1)
        window.cancelAnimationFrame(raf2)
      }
    }

    if (!present) return
    queueMicrotask(() => setPhase('closing'))
    const t = window.setTimeout(() => setPresent(false), 520)
    return () => window.clearTimeout(t)
  }, [open, present])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!present) return null

  const visible = phase === 'open'
  const printPreset = TRIM_PRESETS[theme.print.trimPreset]
  const historyToShow = (showAllHistory ? historyEntries : historyEntries.slice(0, 12)).filter(Boolean)
  const modeBtn = (active: boolean) =>
    `rounded-2xl px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
      active
        ? 'bg-ink text-parchment dark:bg-cream dark:text-ink'
        : 'text-ink/70 hover:bg-dust/30 dark:text-ink-dark/70 dark:hover:bg-border-dark/50'
    }`

  return (
    <>
      <button
        type="button"
        aria-label="Close book tools"
        className="inkwell-drawer-backdrop fixed inset-0 z-[100] bg-ink/20 backdrop-blur-[2px] dark:bg-black/40"
        style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-tools-title"
        className="inkwell-drawer-panel fixed right-0 top-0 z-[101] flex h-full w-full max-w-md flex-col border-l border-dust bg-white shadow-2xl dark:border-border-dark dark:bg-panel-dark"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(110%)' }}
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
              Workspace
            </h3>
            <div className="rounded-2xl border border-dust bg-parchment/80 p-2 dark:border-border-dark dark:bg-panel-dark/80">
              <div className="flex flex-wrap gap-1">
                <button type="button" className={modeBtn(mode === 'write')} onClick={() => onSetMode('write')}>
                  Write
                </button>
                <button
                  type="button"
                  className={modeBtn(mode === 'review_print')}
                  onClick={() => onSetMode('review_print')}
                  title="Review: Print"
                >
                  Review: Print
                </button>
                <button
                  type="button"
                  className={modeBtn(mode === 'review_ebook')}
                  onClick={() => onSetMode('review_ebook')}
                  title="Review: Ebook"
                >
                  Review: Ebook
                </button>
              </div>
            </div>
          </section>

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
              Theme
            </h3>

            <div className="rounded-2xl border border-dust bg-parchment/80 p-4 dark:border-border-dark dark:bg-panel-dark/80 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink dark:text-ink-dark">Print</div>
                  <div className="mt-0.5 text-xs text-ink/60 dark:text-ink-dark/60">
                    Trim {printPreset.widthIn}" × {printPreset.heightIn}"
                  </div>
                </div>
                <label className="block min-w-[12rem] space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                    Trim preset
                  </span>
                  <select
                    value={theme.print.trimPreset}
                    onChange={(e) =>
                      onThemeChange({ print: { trimPreset: e.target.value as TrimPresetId } })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-3 py-2 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  >
                    {Object.values(TRIM_PRESETS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Font size (pt)</span>
                  <input
                    type="number"
                    step={0.5}
                    min={8}
                    max={18}
                    value={theme.print.fontSizePt}
                    onChange={(e) =>
                      onThemeChange({
                        print: { fontSizePt: clampNumber(e.target.value, theme.print.fontSizePt, 8, 18) },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Line height</span>
                  <input
                    type="number"
                    step={0.05}
                    min={1.1}
                    max={2.2}
                    value={theme.print.lineHeight}
                    onChange={(e) =>
                      onThemeChange({
                        print: { lineHeight: clampNumber(e.target.value, theme.print.lineHeight, 1.1, 2.2) },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Top margin (in)</span>
                  <input
                    type="number"
                    step={0.05}
                    min={0.25}
                    max={2}
                    value={theme.print.marginTopIn}
                    onChange={(e) =>
                      onThemeChange({
                        print: { marginTopIn: clampNumber(e.target.value, theme.print.marginTopIn, 0.25, 2) },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Bottom margin (in)</span>
                  <input
                    type="number"
                    step={0.05}
                    min={0.25}
                    max={2}
                    value={theme.print.marginBottomIn}
                    onChange={(e) =>
                      onThemeChange({
                        print: {
                          marginBottomIn: clampNumber(
                            e.target.value,
                            theme.print.marginBottomIn,
                            0.25,
                            2,
                          ),
                        },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Inner margin (in)</span>
                  <input
                    type="number"
                    step={0.05}
                    min={0.25}
                    max={2}
                    value={theme.print.marginInnerIn}
                    onChange={(e) =>
                      onThemeChange({
                        print: { marginInnerIn: clampNumber(e.target.value, theme.print.marginInnerIn, 0.25, 2) },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Outer margin (in)</span>
                  <input
                    type="number"
                    step={0.05}
                    min={0.25}
                    max={2}
                    value={theme.print.marginOuterIn}
                    onChange={(e) =>
                      onThemeChange({
                        print: { marginOuterIn: clampNumber(e.target.value, theme.print.marginOuterIn, 0.25, 2) },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Gutter (in)</span>
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={theme.print.gutterIn}
                    onChange={(e) =>
                      onThemeChange({
                        print: { gutterIn: clampNumber(e.target.value, theme.print.gutterIn, 0, 1) },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-dust bg-parchment px-4 py-3 text-sm dark:border-border-dark dark:bg-panel-dark">
                  <span className="text-sm font-medium text-ink/80 dark:text-ink-dark/80">Hyphenation</span>
                  <input
                    type="checkbox"
                    checked={theme.print.hyphenation}
                    onChange={(e) => onThemeChange({ print: { hyphenation: e.target.checked } })}
                    className="h-4 w-4 accent-ink dark:accent-cream"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-dust bg-parchment/80 p-4 dark:border-border-dark dark:bg-panel-dark/80 space-y-3">
              <div className="text-sm font-semibold text-ink dark:text-ink-dark">Ebook</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Base font size (px)</span>
                  <input
                    type="number"
                    step={1}
                    min={12}
                    max={28}
                    value={theme.ebook.baseFontSizePx}
                    onChange={(e) =>
                      onThemeChange({
                        ebook: {
                          baseFontSizePx: clampNumber(
                            e.target.value,
                            theme.ebook.baseFontSizePx,
                            12,
                            28,
                          ),
                        },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Line height</span>
                  <input
                    type="number"
                    step={0.05}
                    min={1.1}
                    max={2.4}
                    value={theme.ebook.lineHeight}
                    onChange={(e) =>
                      onThemeChange({
                        ebook: { lineHeight: clampNumber(e.target.value, theme.ebook.lineHeight, 1.1, 2.4) },
                      })
                    }
                    className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                  />
                </label>
              </div>
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

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Review & export
            </h3>
            <div className="rounded-2xl border border-dust bg-parchment/80 p-4 dark:border-border-dark dark:bg-panel-dark/80 space-y-3">
              <button
                type="button"
                onClick={onOpenPrintReview}
                className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-parchment transition-colors hover:bg-walnut dark:bg-cream dark:text-ink dark:hover:bg-accent-warm"
              >
                Open Print Review
              </button>
              <button
                type="button"
                onClick={onOpenEbookReview}
                className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
              >
                Open Ebook Review
              </button>
              <button
                type="button"
                onClick={onExportPdfKdp}
                className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
              >
                Export PDF (KDP)
              </button>
              <button
                type="button"
                onClick={onExportEpub}
                className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
              >
                Export EPUB
              </button>
              <label className="block">
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    // Reset input so importing same file twice still triggers onChange.
                    e.currentTarget.value = ''
                    if (!f) return
                    onImportDocx(f)
                  }}
                />
                <span className="block w-full cursor-pointer rounded-2xl border border-dashed border-dust bg-white/40 px-4 py-3 text-center text-sm font-semibold text-ink/80 transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/40 dark:text-ink-dark/80 dark:hover:bg-panel-dark/70">
                  Import DOCX…
                </span>
              </label>
              <div className="text-xs text-ink/60 dark:text-ink-dark/60">
                Print export uses trim, margins, and manual page breaks. EPUB uses ebook theme and reflow.
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Recovery
            </h3>
            <div className="rounded-2xl border border-dust bg-parchment/80 p-4 dark:border-border-dark dark:bg-panel-dark/80 space-y-3">
              <div className="text-xs text-ink/60 dark:text-ink-dark/60">
                Inkwell keeps local recovery snapshots for this book (<span className="font-mono">{projectId}</span>).
              </div>

              {historyEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-dust bg-white/40 p-4 text-sm text-ink/60 dark:border-border-dark dark:bg-panel-dark/40 dark:text-ink-dark/60">
                  No snapshots yet. Keep writing—snapshots appear automatically.
                </div>
              ) : (
                <div className="space-y-2">
                  {historyToShow.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => onRestoreHistory(h.id)}
                      className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-left text-sm transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:bg-panel-dark/90"
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
                      className="w-full rounded-2xl border border-dust bg-white/40 px-4 py-2.5 text-sm font-semibold text-ink/80 transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/40 dark:text-ink-dark/80 dark:hover:bg-panel-dark/70"
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
                Tip: Restoring a snapshot will replace the current book state. Inkwell will automatically snapshot your current state first.
              </div>
            </div>
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
