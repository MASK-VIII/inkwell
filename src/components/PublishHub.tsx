import type { BookMeta } from '../types'

/** When omitted, all export actions are allowed (e.g. dev builds). */
export type PublishAccessProps = {
  allowEpub: boolean
  allowProSuite: boolean
  allowCloudBackup: boolean
  allowEbookFormat: boolean
  allowPrintFormat: boolean
  onUnlockEpub: () => void
  onUnlockPro: () => void
}

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
  onCloudBackupLibrary?: () => void
  cloudBackupBusy?: boolean
  publishAccess?: PublishAccessProps
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
  onCloudBackupLibrary,
  cloudBackupBusy = false,
  publishAccess,
}: PublishHubProps) {
  const pa: PublishAccessProps =
    publishAccess ?? {
      allowEpub: true,
      allowProSuite: true,
      allowCloudBackup: true,
      allowEbookFormat: true,
      allowPrintFormat: true,
      onUnlockEpub: () => {},
      onUnlockPro: () => {},
    }

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
            onClick={() => {
              if (!pa.allowProSuite) {
                pa.onUnlockPro()
                return
              }
              onExportPdfKdp()
            }}
            className="inkwell-hub-primary"
          >
            Export PDF (KDP)
            {!pa.allowProSuite ? <span className="ml-1 text-[11px] font-normal opacity-80">· Pro</span> : null}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!pa.allowEpub) {
                pa.onUnlockEpub()
                return
              }
              onExportEpub()
            }}
            className="inkwell-hub-secondary"
          >
            Export EPUB
            {!pa.allowEpub ? <span className="ml-1 text-[11px] font-normal opacity-80">· Basic</span> : null}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!pa.allowProSuite) {
                pa.onUnlockPro()
                return
              }
              onExportDocx()
            }}
            className="inkwell-hub-secondary"
          >
            Export DOCX
            {!pa.allowProSuite ? <span className="ml-1 text-[11px] font-normal opacity-80">· Pro</span> : null}
          </button>
        </div>
        <p className="text-xs text-ink/60 dark:text-ink-dark/60">
          Print layout and page breaks live under Format. EPUB uses your ebook theme and reflowable HTML. DOCX is a
          Word-compatible manuscript for editors and agents.
        </p>
        {(onOpenFormatPrint || onOpenFormatEbook) && (
          <div className="flex flex-wrap gap-2">
            {onOpenFormatPrint ? (
              <button
                type="button"
                onClick={() => {
                  if (!pa.allowPrintFormat) {
                    pa.onUnlockPro()
                    return
                  }
                  onOpenFormatPrint()
                }}
                className="inkwell-hub-tertiary"
              >
                Open print format
                {!pa.allowPrintFormat ? <span className="ml-1 text-[11px] opacity-80">· Pro</span> : null}
              </button>
            ) : null}
            {onOpenFormatEbook ? (
              <button
                type="button"
                onClick={() => {
                  if (!pa.allowEbookFormat) {
                    pa.onUnlockEpub()
                    return
                  }
                  onOpenFormatEbook()
                }}
                className="inkwell-hub-tertiary"
              >
                Open ebook format
                {!pa.allowEbookFormat ? <span className="ml-1 text-[11px] opacity-80">· Unlock</span> : null}
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
                if (!pa.allowProSuite) {
                  pa.onUnlockPro()
                  return
                }
                onImportDocx(f)
              }}
            />
            <span className="inkwell-hub-dropzone">Import DOCX…</span>
            {!pa.allowProSuite ? (
              <span className="mt-1 block text-[11px] text-ink/55 dark:text-ink-dark/55">Requires Inkwell Pro.</span>
            ) : null}
          </label>
          {onExportTxt ? (
            <button
              type="button"
              onClick={() => {
                if (!pa.allowProSuite) {
                  pa.onUnlockPro()
                  return
                }
                onExportTxt()
              }}
              className="inkwell-hub-row-btn"
            >
              Export plain text (.txt)
              {!pa.allowProSuite ? <span className="ml-1 text-[11px] opacity-80">· Pro</span> : null}
            </button>
          ) : null}
          {onExportProjectArchive ? (
            <button
              type="button"
              onClick={() => {
                if (!pa.allowProSuite) {
                  pa.onUnlockPro()
                  return
                }
                onExportProjectArchive()
              }}
              className="inkwell-hub-row-btn"
            >
              Export book backup (.inkwell.zip)
              {!pa.allowProSuite ? <span className="ml-1 text-[11px] opacity-80">· Pro</span> : null}
            </button>
          ) : null}
          {onExportLibraryArchive ? (
            <button
              type="button"
              onClick={() => {
                if (!pa.allowProSuite) {
                  pa.onUnlockPro()
                  return
                }
                onExportLibraryArchive()
              }}
              className="inkwell-hub-row-btn"
            >
              Export full library (.zip)
              {!pa.allowProSuite ? <span className="ml-1 text-[11px] opacity-80">· Pro</span> : null}
            </button>
          ) : null}
          {onCloudBackupLibrary ? (
            <button
              type="button"
              onClick={() => {
                if (!pa.allowCloudBackup) {
                  pa.onUnlockPro()
                  return
                }
                onCloudBackupLibrary()
              }}
              disabled={cloudBackupBusy}
              className="inkwell-hub-row-btn disabled:opacity-50"
            >
              {cloudBackupBusy ? 'Uploading…' : 'Upload full library to cloud'}
              {!pa.allowCloudBackup ? <span className="ml-1 text-[11px] opacity-80">· Pro</span> : null}
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
