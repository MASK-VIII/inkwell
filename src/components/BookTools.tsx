import { ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  BookAssembly,
  BookMeta,
  ChapterNumberMode,
  ProjectMeta,
  SeriesBibleEntry,
  WritingGoals,
} from '../types'
import { buildInkwellUrlForProject, type ProjectHistoryEntry } from '../lib/manuscripts'
import { CollapsibleSection } from './book-tools/CollapsibleSection'
import { HistoryPanel } from './book-tools/HistoryPanel'
import { ProgressBar } from './book-tools/ProgressBar'

/** Book or note that owns this project’s linked notes; always listed first under “Notebook” for notes. */
export type NotesProjectMasterRow = {
  id: string
  title: string
  kind: 'book' | 'note'
  /** True when the main editor is already on this project (the master row is “you are here”). */
  isCurrent: boolean
  /** Parent id set but project blob missing */
  missing: boolean
}

export type WorkspaceRoute = 'write' | 'format_print' | 'format_ebook' | 'publish'

type Props = {
  open: boolean
  onClose: () => void
  projectId: string
  variant?: 'book' | 'note'
  workspaceRoute: WorkspaceRoute
  onSetWorkspaceRoute: (route: WorkspaceRoute) => void
  book: BookMeta
  onBookChange: (patch: Partial<BookMeta>) => void
  goals: WritingGoals
  onGoalsChange: (patch: Partial<WritingGoals>) => void
  totalBookWords: number
  wordsWrittenToday: number
  onExportPdfKdp: () => void
  onExportEpub: () => void
  onImportDocx: (file: File) => void
  historyEntries: ProjectHistoryEntry[]
  onRestoreHistory: (snapshotId: string) => void
  onClearHistory: () => void
  /** Opens a new note linked to this project (book or note) and navigates to write */
  onNewNoteForBook?: () => void
  /** Linked child notes under the shelf parent (siblings when editing a child note; excludes current note). */
  linkedNotesForBook?: ProjectMeta[]
  /** Open a linked note in a floating editor over the workspace */
  onPopoutLinkedNote?: (noteId: string) => void
  /** Master workspace (book or note) for this project’s note list; shown first in the list. */
  notesProjectMaster?: NotesProjectMasterRow | null
  /** Open a book or note in the main editor (used for the master row). */
  onOpenProjectInMain?: (projectId: string) => void
  assembly?: BookAssembly
  onAssemblyChange?: (patch: Partial<BookAssembly>) => void
  seriesBible?: SeriesBibleEntry[]
  onSeriesBibleChange?: (rows: SeriesBibleEntry[]) => void
  onExportProjectArchive?: () => void
  onExportLibraryArchive?: () => void
  onImportProjectArchive?: (file: File) => void
  onExportTxt?: () => void
}

export function BookTools({
  open,
  onClose,
  projectId,
  variant = 'book',
  workspaceRoute,
  onSetWorkspaceRoute,
  book,
  onBookChange,
  goals,
  onGoalsChange,
  totalBookWords,
  wordsWrittenToday,
  onExportPdfKdp,
  onExportEpub,
  onImportDocx,
  historyEntries,
  onRestoreHistory,
  onClearHistory,
  onNewNoteForBook,
  linkedNotesForBook = [],
  onPopoutLinkedNote,
  notesProjectMaster = null,
  onOpenProjectInMain,
  assembly,
  onAssemblyChange,
  seriesBible = [],
  onSeriesBibleChange,
  onExportProjectArchive,
  onExportLibraryArchive,
  onImportProjectArchive,
  onExportTxt,
}: Props) {
  const isNote = variant === 'note'
  const isFormat = workspaceRoute === 'format_print' || workspaceRoute === 'format_ebook'
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

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-3">
          {!isNote ? (
            <CollapsibleSection
              title="Workspace"
              description="Draft in Write, tune layout in Format, then export from Publish."
              defaultOpen
            >
              <div className="space-y-2 rounded-xl bg-parchment/60 p-2 dark:bg-panel-dark/50">
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className={modeBtn(workspaceRoute === 'write')}
                    onClick={() => onSetWorkspaceRoute('write')}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    className={modeBtn(isFormat)}
                    onClick={() => onSetWorkspaceRoute('format_ebook')}
                    title="Format: ebook and print previews"
                  >
                    Format
                  </button>
                  <button
                    type="button"
                    className={modeBtn(workspaceRoute === 'publish')}
                    onClick={() => onSetWorkspaceRoute('publish')}
                  >
                    Publish
                  </button>
                </div>
              </div>
            </CollapsibleSection>
          ) : null}

          {isNote || workspaceRoute !== 'publish' ?
            onNewNoteForBook != null || linkedNotesForBook.length > 0 || notesProjectMaster != null ?
              <CollapsibleSection
                title={isNote ? 'Notebook' : 'Linked notes'}
                description="Notes attached to this book or master project."
                defaultOpen={false}
              >
              {onNewNoteForBook ? (
                <button
                  type="button"
                  onClick={() => {
                    onNewNoteForBook()
                  }}
                  className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                >
                  {isNote ? 'New note in this project' : 'New note for this book'}
                </button>
              ) : null}
              <div className="space-y-3">
                {notesProjectMaster || linkedNotesForBook.length > 0 ? (
                  <ul className="space-y-2">
                    {notesProjectMaster ? (
                      <li key={`master-${notesProjectMaster.id}`}>
                        {notesProjectMaster.missing ? (
                          <div className="rounded-2xl border border-dashed border-dust/80 bg-white/50 px-4 py-3 text-left text-sm text-ink/70 dark:border-border-dark dark:bg-panel-dark/50 dark:text-ink-dark/70">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-walnut dark:text-accent-warm">
                              Master
                            </span>
                            <span className="mt-1 block">Linked project not found on this device.</span>
                          </div>
                        ) : notesProjectMaster.isCurrent ? (
                          <a
                            href={buildInkwellUrlForProject(notesProjectMaster.id)}
                            onClick={(e) => e.preventDefault()}
                            className="block rounded-2xl border-2 border-walnut/35 bg-parchment/90 px-4 py-3 dark:border-accent-warm/40 dark:bg-panel-dark/90"
                          >
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-walnut dark:text-accent-warm">
                              Master · {notesProjectMaster.kind === 'book' ? 'Book' : 'Note'}
                            </span>
                            <span className="mt-1 block truncate font-medium text-ink dark:text-ink-dark">
                              {notesProjectMaster.title || 'Untitled'}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink/45 dark:text-ink-dark/45">
                              Current workspace
                            </span>
                          </a>
                        ) : (
                          <div className="group flex overflow-hidden rounded-2xl border-2 border-walnut/35 bg-white/70 transition-colors duration-150 hover:border-walnut/55 hover:bg-white dark:border-accent-warm/40 dark:bg-panel-dark/70 dark:hover:border-accent-warm/60 dark:hover:bg-panel-dark/90">
                            <a
                              href={buildInkwellUrlForProject(notesProjectMaster.id)}
                              onClick={(e) => {
                                e.preventDefault()
                                onOpenProjectInMain?.(notesProjectMaster.id)
                                onClose()
                              }}
                              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-left focus-visible:outline focus-visible:ring-2 focus-visible:ring-walnut/35 dark:focus-visible:ring-accent-warm/40"
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-walnut dark:text-accent-warm">
                                Master · {notesProjectMaster.kind === 'book' ? 'Book' : 'Note'}
                              </span>
                              <span className="mt-1 block truncate font-medium text-ink dark:text-ink-dark">
                                {notesProjectMaster.title || 'Untitled'}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-ink/45 dark:text-ink-dark/45">
                                Open in main editor
                              </span>
                            </a>
                            {notesProjectMaster.kind === 'note' ? (
                              <button
                                type="button"
                                title="Open floating editor"
                                aria-label="Open floating editor"
                                className="inline-flex w-11 shrink-0 items-center justify-center border-l-2 border-walnut/25 bg-transparent text-ink/55 transition-colors group-hover:text-ink dark:border-accent-warm/30 dark:group-hover:text-ink-dark"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onPopoutLinkedNote?.(notesProjectMaster.id)
                                  onClose()
                                }}
                              >
                                <ExternalLink className="h-4 w-4" strokeWidth={2.25} />
                              </button>
                            ) : null}
                          </div>
                        )}
                      </li>
                    ) : null}
                    {linkedNotesForBook.map((n) => (
                      <li key={n.id}>
                        <div className="group flex overflow-hidden rounded-2xl border border-dust bg-white/70 transition-colors duration-150 hover:border-walnut/40 hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:hover:border-accent-warm/45 dark:hover:bg-panel-dark/90">
                          <a
                            href={buildInkwellUrlForProject(n.id)}
                            onClick={(e) => {
                              e.preventDefault()
                              onOpenProjectInMain?.(n.id)
                              onClose()
                            }}
                            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-left focus-visible:outline focus-visible:ring-2 focus-visible:ring-walnut/30 dark:focus-visible:ring-accent-warm/40"
                          >
                            <span className="block truncate font-medium text-ink dark:text-ink-dark">
                              {n.title || 'Untitled note'}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink/45 dark:text-ink-dark/45">
                              Open in main editor
                            </span>
                          </a>
                          <button
                            type="button"
                            title="Open floating editor"
                            aria-label="Open floating editor"
                            className="inline-flex w-11 shrink-0 items-center justify-center border-l border-dust/80 bg-transparent text-ink/55 transition-colors group-hover:text-ink dark:border-border-dark dark:group-hover:text-ink-dark"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPopoutLinkedNote?.(n.id)
                              onClose()
                            }}
                          >
                            <ExternalLink className="h-4 w-4" strokeWidth={2.25} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {linkedNotesForBook.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-dust/80 bg-white/50 px-4 py-3 text-sm text-ink/55 dark:border-border-dark dark:bg-panel-dark/50 dark:text-ink-dark/55">
                    {notesProjectMaster && !notesProjectMaster.isCurrent ? (
                      <>
                        No other notes in this project yet. Use the button above or drag notes onto the master on the
                        bookshelf.
                      </>
                    ) : isNote ? (
                      <>
                        This project has no notes yet. Use the button above or drag notes onto this project on the
                        bookshelf.
                      </>
                    ) : (
                      <>
                        No linked notes yet. Use the button above or drag notes onto this book on the bookshelf (or
                        onto another note).
                      </>
                    )}
                  </p>
                ) : null}
              </div>
            </CollapsibleSection>
          : null
          : null}

          {!isNote && (workspaceRoute === 'write' || workspaceRoute === 'publish') ? (
            <CollapsibleSection
              title="Book details"
              description={
                workspaceRoute === 'publish' ?
                  'Title, author, and EPUB fields used by KDP and readers.'
                : 'Metadata for exports and the shelf.'
              }
              defaultOpen={workspaceRoute === 'publish'}
            >
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
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Language (EPUB)</span>
                    <input
                      type="text"
                      value={book.language ?? ''}
                      onChange={(e) => onBookChange({ language: e.target.value || undefined })}
                      placeholder="en"
                      className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">ISBN (optional)</span>
                    <input
                      type="text"
                      value={book.isbn ?? ''}
                      onChange={(e) => onBookChange({ isbn: e.target.value || undefined })}
                      placeholder="978…"
                      className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Series #</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={book.seriesIndex ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        onBookChange({
                          seriesIndex: raw === '' ? null : Math.max(0, Number(raw) || 0),
                        })
                      }}
                      placeholder="Optional"
                      className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Description</span>
                    <textarea
                      value={book.description ?? ''}
                      onChange={(e) => onBookChange({ description: e.target.value || undefined })}
                      placeholder="Short synopsis for EPUB metadata"
                      rows={3}
                      className="w-full resize-y rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Publisher</span>
                    <input
                      type="text"
                      value={book.publisher ?? ''}
                      onChange={(e) => onBookChange({ publisher: e.target.value || undefined })}
                      placeholder="Optional"
                      className="w-full rounded-2xl border border-dust bg-parchment px-4 py-2.5 text-sm focus:border-walnut focus:outline-none dark:border-border-dark dark:bg-panel-dark dark:focus:border-cream"
                    />
                  </label>
              </>
            </div>
          </CollapsibleSection>
          ) : null}

          {!isNote && isFormat && assembly && onAssemblyChange ? (
            <CollapsibleSection
              title="Book structure"
              description="Print TOC and how chapter titles appear in exports."
              defaultOpen={false}
            >
              <div className="space-y-3 rounded-xl bg-parchment/60 p-4 dark:bg-panel-dark/50">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink dark:text-ink-dark">Printable table of contents</span>
                  <input
                    type="checkbox"
                    checked={assembly.includePrintToc}
                    onChange={(e) => onAssemblyChange({ includePrintToc: e.target.checked })}
                    className="h-4 w-4 accent-ink dark:accent-cream"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">TOC title</span>
                  <input
                    type="text"
                    value={assembly.printTocTitle}
                    onChange={(e) => onAssemblyChange({ printTocTitle: e.target.value })}
                    className="w-full rounded-xl border border-dust bg-parchment px-3 py-2 text-sm dark:border-border-dark dark:bg-panel-dark"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink/70 dark:text-ink-dark/70">Chapter labels in exports</span>
                  <select
                    value={assembly.chapterNumberMode}
                    onChange={(e) =>
                      onAssemblyChange({ chapterNumberMode: e.target.value as ChapterNumberMode })
                    }
                    className="w-full rounded-xl border border-dust bg-parchment px-3 py-2 text-sm dark:border-border-dark dark:bg-panel-dark"
                  >
                    <option value="title_only">Title only</option>
                    <option value="chapter_n">Chapter N + title</option>
                  </select>
                </label>
                <p className="text-[11px] text-ink/55 dark:text-ink-dark/55">
                  Front matter exports before body chapters when sections carry role metadata; print TOC uses page
                  numbers from the PDF layout.
                </p>
              </div>
            </CollapsibleSection>
          ) : null}

          {!isNote && workspaceRoute === 'write' && onSeriesBibleChange ? (
            <CollapsibleSection
              title="Series bible (lite)"
              description="Characters, places, and story threads."
              defaultOpen={false}
            >
              <div className="space-y-2 rounded-xl bg-parchment/60 p-4 dark:bg-panel-dark/50">
                {seriesBible.length === 0 ? (
                  <p className="text-sm text-ink/60 dark:text-ink-dark/60">Track characters, places, and threads.</p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {seriesBible.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-2 rounded-xl border border-dust/80 bg-white/60 px-3 py-2 text-sm dark:border-border-dark dark:bg-panel-dark/60"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-ink dark:text-ink-dark">{row.name}</span>
                          <span className="ml-2 text-[10px] uppercase text-walnut dark:text-accent-warm">
                            {row.kind}
                          </span>
                          {row.notes ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-ink/65 dark:text-ink-dark/65">
                              {row.notes}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                          onClick={() => onSeriesBibleChange(seriesBible.filter((r) => r.id !== row.id))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="w-full rounded-xl border border-dashed border-dust py-2 text-sm font-semibold text-ink/80 hover:bg-white/50 dark:border-border-dark dark:text-ink-dark/80 dark:hover:bg-panel-dark/80"
                  onClick={() => {
                    const id =
                      typeof crypto !== 'undefined' && 'randomUUID' in crypto ?
                        crypto.randomUUID()
                      : `b_${Date.now()}`
                    onSeriesBibleChange([
                      ...seriesBible,
                      { id, kind: 'character', name: 'New entry', notes: '' },
                    ])
                  }}
                >
                  Add entry
                </button>
              </div>
            </CollapsibleSection>
          ) : null}

          {isNote || workspaceRoute !== 'publish' ? (
            <CollapsibleSection
              title="Goals & stats"
              description="Word counts and daily targets."
              defaultOpen={false}
            >
            <div className="rounded-xl bg-parchment/60 p-4 dark:bg-panel-dark/50">
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
          </CollapsibleSection>
          ) : null}

          {!isNote && workspaceRoute === 'publish' ? (
            <CollapsibleSection
              title="Publish"
              description="Exports, imports, and library backups."
              defaultOpen
            >
              <div className="space-y-3 rounded-xl bg-parchment/60 p-4 dark:bg-panel-dark/50">
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
                {onExportTxt ? (
                  <button
                    type="button"
                    onClick={onExportTxt}
                    className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                  >
                    Export plain text (.txt)
                  </button>
                ) : null}
                {onExportProjectArchive ? (
                  <button
                    type="button"
                    onClick={onExportProjectArchive}
                    className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                  >
                    Export book backup (.inkwell.zip)
                  </button>
                ) : null}
                {onExportLibraryArchive ? (
                  <button
                    type="button"
                    onClick={onExportLibraryArchive}
                    className="w-full rounded-2xl border border-dust bg-white/70 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
                  >
                    Export full library (.zip)
                  </button>
                ) : null}
                {onImportProjectArchive ? (
                  <label className="block">
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        e.currentTarget.value = ''
                        if (!f) return
                        onImportProjectArchive(f)
                      }}
                    />
                    <span className="block w-full cursor-pointer rounded-2xl border border-dashed border-dust bg-white/40 px-4 py-3 text-center text-sm font-semibold text-ink/80 transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/40 dark:text-ink-dark/80 dark:hover:bg-panel-dark/70">
                      Import backup (.zip)
                    </span>
                  </label>
                ) : null}
                <div className="text-xs text-ink/60 dark:text-ink-dark/60">
                  Print export uses trim, margins, and manual page breaks. EPUB uses ebook theme and reflow. PDF adds a
                  printable TOC when enabled in Book structure.
                </div>
              </div>
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection
            title="Recovery"
            description="Snapshot history and restore points."
            defaultOpen={false}
          >
            <HistoryPanel
              projectId={projectId}
              historyEntries={historyEntries}
              onRestoreHistory={onRestoreHistory}
              onClearHistory={onClearHistory}
            />
          </CollapsibleSection>

        </div>
      </aside>
    </>
  )
}
