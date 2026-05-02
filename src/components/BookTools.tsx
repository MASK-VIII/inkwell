import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { BookMeta, EbookTheme, PrintTheme, ProjectMeta, Theme, WritingGoals } from '../types'
import type { ProjectHistoryEntry } from '../lib/manuscripts'
import { EbookThemeForm } from './book-tools/EbookThemeForm'
import { HistoryPanel } from './book-tools/HistoryPanel'
import { PrintThemeForm } from './book-tools/PrintThemeForm'
import { ProgressBar } from './book-tools/ProgressBar'

type Props = {
  open: boolean
  onClose: () => void
  projectId: string
  variant?: 'book' | 'note'
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
  /** Only for books: opens a new linked note and navigates to write */
  onNewNoteForBook?: () => void
  /** Notes stuck to this book (general writing UI only). */
  linkedNotesForBook?: ProjectMeta[]
  /** Open a linked note in a floating editor over the workspace */
  onPopoutLinkedNote?: (noteId: string) => void
}

export function BookTools({
  open,
  onClose,
  projectId,
  variant = 'book',
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
  onNewNoteForBook,
  linkedNotesForBook = [],
  onPopoutLinkedNote,
}: Props) {
  const isNote = variant === 'note'
  const [present, setPresent] = useState(open)
  const [phase, setPhase] = useState<'entering' | 'open' | 'closing'>(() =>
    open ? 'entering' : 'closing',
  )

  useEffect(() => {
    if (open) {
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
            {isNote ? 'Note tools' : 'Book tools'}
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
          {!isNote ? (
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
              {onNewNoteForBook ? (
                <button
                  type="button"
                  onClick={() => {
                    onNewNoteForBook()
                  }}
                  className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                >
                  New note for this book
                </button>
              ) : null}
              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-walnut/90 dark:text-accent-warm/90">
                  Sticky notes
                </h4>
                {linkedNotesForBook.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-dust/80 bg-white/50 px-4 py-3 text-sm text-ink/55 dark:border-border-dark dark:bg-panel-dark/50 dark:text-ink-dark/55">
                    No notes stuck to this book yet. Use{' '}
                    <span className="font-medium text-ink/75 dark:text-ink-dark/75">New note for this book</span> or
                    drag notes on the shelf.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {linkedNotesForBook.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => onPopoutLinkedNote?.(n.id)}
                          className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-left transition-colors hover:border-walnut/40 hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:border-accent-warm/35 dark:hover:bg-panel-dark/90"
                        >
                          <span className="block truncate font-medium text-ink dark:text-ink-dark">
                            {n.title || 'Untitled note'}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-ink/45 dark:text-ink-dark/45">
                            Open floating editor
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                Workspace
              </h3>
              <div className="rounded-2xl border border-dust bg-parchment/80 p-2 dark:border-border-dark dark:bg-panel-dark/80">
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={modeBtn(mode === 'write')} onClick={() => onSetMode('write')}>
                    Write
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              {isNote ? 'Details' : 'Book details'}
            </h3>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">
                  {isNote ? 'Working title (optional)' : 'Title'}
                </span>
                <input
                  type="text"
                  value={book.title}
                  onChange={(e) => onBookChange({ title: e.target.value })}
                  placeholder={isNote ? 'Optional label for exports' : 'Working title'}
                  className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                />
              </label>
              {!isNote ? (
                <>
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
                </>
              ) : null}
            </div>
          </section>

          {!isNote ? (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
                Theme
              </h3>
              <PrintThemeForm theme={theme} onThemeChange={onThemeChange} />
              <EbookThemeForm theme={theme} onThemeChange={onThemeChange} />
            </section>
          ) : null}

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
                <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Daily word goal</span>
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
              <ProgressBar label="Today's progress" current={wordsWrittenToday} target={goals.dailyWordGoal} />
            )}
          </section>

          {!isNote ? (
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
          ) : null}

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-walnut dark:text-accent-warm">
              Recovery
            </h3>
            <HistoryPanel
              projectId={projectId}
              historyEntries={historyEntries}
              onRestoreHistory={onRestoreHistory}
              onClearHistory={onClearHistory}
            />
          </section>

          <section className="rounded-2xl border border-dashed border-dust p-4 text-sm text-ink/55 dark:border-border-dark dark:text-ink-dark/55">
            <p className="font-medium text-ink/70 dark:text-ink-dark/70">Coming next</p>
            <p className="mt-1">
              Outline, find & replace, front matter, and more export options will live here as they ship.
            </p>
          </section>
        </div>
      </aside>

    </>
  )
}
