/**
 * Compact “what happens in one app” strip—helps Product Hunt / skim traffic grok Inkwell in seconds.
 */
export function PhWorkflowStrip() {
  const steps = [
    {
      title: 'Write locally',
      body: 'Chapters, notes, light & dark. Free tier: full workspace, no signup.',
    },
    {
      title: 'Preview layout',
      body: 'Print and ebook interiors before you chase pixels in five other tools.',
    },
    {
      title: 'Export when ready',
      body: 'EPUB, print-ready PDF, DOCX, Markdown, and more—every export included, free.',
    },
  ]

  return (
    <section
      aria-label="Inkwell workflow"
      className="border-b border-dust/60 bg-panel-light-muted/45 dark:border-border-dark/80 dark:bg-panel-dark/50"
    >
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-9">
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-dust/60 bg-parchment/75 px-4 py-4 dark:border-border-dark dark:bg-panel-dark/65 sm:px-5 sm:py-4"
            >
              <p className="font-serif text-lg text-ink dark:text-ink-dark">{s.title}</p>
              <p className="mt-1.5 text-sm leading-snug text-walnut/85 dark:text-ink-dark/75">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
