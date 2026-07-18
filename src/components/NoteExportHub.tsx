export type NoteExportHubProps = {
  noteTitle: string
  wordCount: number
  onOpenNoteTools: () => void
  onBackToWrite: () => void
  onExportTxt: () => void
  onExportProjectArchive: () => void
  onExportLibraryArchive: () => void
  onImportProjectArchive: (file: File) => void
  onCopyFormattedHtml: () => void
  onCopyMarkdown: () => void
  onDownloadHtml: () => void
}

function readinessRow(label: string, ok: boolean, value: string) {
  return (
    <div className="flex gap-3 rounded-xl border border-dust/80 bg-panel-light-muted/82 px-4 py-3 dark:border-border-dark dark:bg-panel-dark/60">
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

export function NoteExportHub({
  noteTitle,
  wordCount,
  onOpenNoteTools,
  onBackToWrite,
  onExportTxt,
  onExportProjectArchive,
  onExportLibraryArchive,
  onImportProjectArchive,
  onCopyFormattedHtml,
  onCopyMarkdown,
  onDownloadHtml,
}: NoteExportHubProps) {
  const titleOk = Boolean(noteTitle?.trim()) && noteTitle.trim() !== 'Untitled note'
  const wordsLabel = wordCount === 1 ? '1 word' : `${wordCount.toLocaleString()} words`

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-8 overflow-auto px-4 py-8 sm:px-8 sm:py-12">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink dark:text-ink-dark sm:text-3xl">
            Export
          </h1>
          <button type="button" onClick={onBackToWrite} className="inkwell-hub-tertiary">
            Back to Write
          </button>
        </div>
        <p className="text-sm text-ink/70 dark:text-ink-dark/70">
          Copy formatted content for Substack, Medium, Ghost, and other web editors; download plain files; and keep
          backups. Refine the title in the header or in Note tools.
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="note-export-readiness-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="note-export-readiness-heading" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
            Note readiness
          </h2>
          <button type="button" onClick={onOpenNoteTools} className="inkwell-hub-tertiary">
            Open Note tools
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {readinessRow('Title', titleOk, noteTitle?.trim() || '')}
          {readinessRow('Length', wordCount > 0, wordsLabel)}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="note-export-web-heading">
        <h2 id="note-export-web-heading" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
          Post on the web
        </h2>
        <p className="text-sm text-ink/70 dark:text-ink-dark/70">
          <strong className="font-medium text-ink dark:text-ink-dark">Substack:</strong> open Substack → New post →
          paste with <kbd className="rounded border border-dust px-1.5 py-0.5 font-mono text-xs dark:border-border-dark">Ctrl+V</kbd>{' '}
          (Windows) or <kbd className="rounded border border-dust px-1.5 py-0.5 font-mono text-xs dark:border-border-dark">⌘V</kbd>{' '}
          (Mac). Most browsers paste both HTML and plain text; the composer usually keeps headings, lists, and links.
          Re-upload images manually if they do not appear.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={onCopyFormattedHtml} className="inkwell-hub-primary">
            Copy formatted HTML for paste
          </button>
          <button type="button" onClick={onCopyMarkdown} className="inkwell-hub-secondary">
            Copy Markdown
          </button>
          <button type="button" onClick={onDownloadHtml} className="inkwell-hub-secondary">
            Download .html
          </button>
        </div>
        <p className="text-xs text-ink/55 dark:text-ink-dark/55">
          HTML is generated from your note content (not the live editor). Some Inkwell-only blocks may simplify to plain
          text. Embedded images in pasted HTML may be large or stripped by the host—check the preview before publishing.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="note-export-files-heading">
        <h2 id="note-export-files-heading" className="font-serif text-lg font-semibold text-ink dark:text-ink-dark">
          Files and backups
        </h2>
        <div className="inkwell-hub-card">
          <button type="button" onClick={onExportTxt} className="inkwell-hub-row-btn">
            Export plain text (.txt)
          </button>
          <button type="button" onClick={onExportProjectArchive} className="inkwell-hub-row-btn">
            Export note backup (.inkwell.zip)
          </button>
          <button type="button" onClick={onExportLibraryArchive} className="inkwell-hub-row-btn">
            Export full library (.zip)
          </button>
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
            <span className="inkwell-hub-dropzone">Import backup (.zip)</span>
          </label>
        </div>
      </section>
    </div>
  )
}
