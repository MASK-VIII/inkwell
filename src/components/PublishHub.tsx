import type { BookMeta } from '../types'

export type PublishHubProps = {
  book: BookMeta
  onOpenBookTools: () => void
  onExportPdfKdp: () => void
  onExportEpub: () => void
  onExportDocx: () => void
  onImportDocx: (file: File) => void
  onExportTxt?: () => void
  onExportProjectArchive?: () => void
  onExportLibraryArchive?: () => void
  onImportProjectArchive?: (file: File) => void
  onOpenFormatPrint?: () => void
  onOpenFormatEbook?: () => void
  /** True while KDP PDF is being generated (pagination + pdf-lib are CPU-heavy). */
  pdfExportBusy?: boolean
  /** Detailed status while busy (e.g. page render progress). */
  pdfExportLabel?: string
}

function checklistRow(label: string, ok: boolean, value: string) {
  return (
    <div className="inkwell-theme-bridge flex gap-3 rounded-xl border border-dust/80 bg-panel-light-muted/82 px-4 py-3 dark:border-border-dark dark:bg-panel-dark/60">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          ok ? 'bg-emerald-600/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200'
        }`}
        aria-hidden
      >
        {ok ? '✓' : '!'}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-walnut dark:text-accent-warm">{label}</div>
        <div className="mt-0.5 truncate text-sm text-ink dark:text-ink-dark" title={value}>
          {value || '—'}
        </div>
      </div>
    </div>
  )
}

export function PublishHub({
  book,
  onOpenBookTools,
  onExportPdfKdp,
  onExportEpub,
  onExportDocx,
  onImportDocx,
  onExportTxt,
  onExportProjectArchive,
  onExportLibraryArchive,
  onImportProjectArchive,
  onOpenFormatPrint,
  onOpenFormatEbook,
  pdfExportBusy = false,
  pdfExportLabel = '',
}: PublishHubProps) {
  const titleOk = Boolean(book.title?.trim())
  const authorOk = Boolean(book.authorName?.trim())
  const langOk = Boolean((book.language ?? '').trim())
  const descOk = Boolean((book.description ?? '').trim())

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 overflow-auto px-4 py-8 sm:px-8 sm:py-12">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink dark:text-ink-dark sm:text-3xl">
          Publish
        </h1>
        <p className="text-sm text-ink/70 dark:text-ink-dark/70">
          Export for KDP and EPUB, import drafts, and keep backups. Refine metadata in Book tools when something is
          missing.
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="publish-checklist-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="publish-checklist-heading" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
            Export readiness
          </h2>
          <button type="button" onClick={onOpenBookTools} className="inkwell-hub-tertiary">
            Edit in Book tools
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {checklistRow('Title', titleOk, book.title?.trim() || '')}
          {checklistRow('Author', authorOk, book.authorName?.trim() || '')}
          {checklistRow('Language (EPUB)', langOk, (book.language ?? '').trim() || '')}
          {checklistRow('Description', descOk, (book.description ?? '').trim() || '')}
        </div>
        {(book.isbn ?? '').trim() ? (
          <p className="text-xs text-ink/60 dark:text-ink-dark/60">
            ISBN: <span className="font-medium text-ink dark:text-ink-dark">{book.isbn}</span>
          </p>
        ) : (
          <p className="text-xs text-ink/55 dark:text-ink-dark/55">ISBN is optional for many ebook listings.</p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="publish-primary-heading">
        <h2 id="publish-primary-heading" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
          Primary exports
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={pdfExportBusy}
            onClick={onExportPdfKdp}
            className="inkwell-hub-primary disabled:pointer-events-none disabled:opacity-55"
          >
            {pdfExportBusy ? (pdfExportLabel.trim() || 'Preparing PDF…') : 'Export PDF (KDP)'}
          </button>
          <button type="button" onClick={onExportEpub} className="inkwell-hub-secondary">
            Export EPUB
          </button>
          <button type="button" onClick={onExportDocx} className="inkwell-hub-secondary">
            Export DOCX
          </button>
        </div>
        <p className="text-xs text-ink/60 dark:text-ink-dark/60">
          Print layout and page breaks live under Format. EPUB uses your ebook theme and reflowable HTML. DOCX is a
          Word-compatible manuscript for editors and agents.
        </p>
        {(onOpenFormatPrint || onOpenFormatEbook) && (
          <div className="flex flex-wrap gap-2">
            {onOpenFormatPrint ? (
              <button type="button" onClick={onOpenFormatPrint} className="inkwell-hub-tertiary">
                Open print format
              </button>
            ) : null}
            {onOpenFormatEbook ? (
              <button type="button" onClick={onOpenFormatEbook} className="inkwell-hub-tertiary">
                Open ebook format
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="publish-secondary-heading">
        <h2 id="publish-secondary-heading" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
          Import and backups
        </h2>
        <div className="inkwell-hub-card">
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
            <span className="inkwell-hub-dropzone">Import DOCX…</span>
          </label>
          {onExportTxt ? (
            <button type="button" onClick={onExportTxt} className="inkwell-hub-row-btn">
              Export plain text (.txt)
            </button>
          ) : null}
          {onExportProjectArchive ? (
            <button type="button" onClick={onExportProjectArchive} className="inkwell-hub-row-btn">
              Export book backup (.inkwell.zip)
            </button>
          ) : null}
          {onExportLibraryArchive ? (
            <button type="button" onClick={onExportLibraryArchive} className="inkwell-hub-row-btn">
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
              <span className="inkwell-hub-dropzone bg-panel-light-muted/55 dark:bg-panel-dark/40">Import backup (.zip)</span>
            </label>
          ) : null}
        </div>
      </section>
    </div>
  )
}
