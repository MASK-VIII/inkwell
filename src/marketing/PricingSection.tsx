import { Download } from 'lucide-react'
import { getInkwellDesktopDownloadUrl } from '../lib/marketing/desktopDownloadUrl'

function TrustRow() {
  const items = [
    { label: 'Free forever', detail: 'The whole app, no paid tiers' },
    { label: 'No account', detail: 'Start instantly, no signup' },
    { label: 'All exports included', detail: 'EPUB, PDF, DOCX, Markdown' },
    { label: 'Local-first', detail: 'Your work stays on your device' },
    { label: 'Unlimited local storage', detail: 'On your device' },
  ]

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-dust/70 bg-panel-light-muted/62 px-4 py-3 text-sm text-walnut/85 dark:border-border-dark dark:bg-panel-dark/50 dark:text-ink-dark/78"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">{it.label}</p>
          <p className="mt-1">{it.detail}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * Free-product section (kept at `id="pricing"` so old anchors still land here).
 * Inkwell has no paid tiers: the full workspace and every export are free and local.
 */
export function PricingSection() {
  const desktopDownloadUrl = getInkwellDesktopDownloadUrl()

  return (
    <section id="pricing" className="bg-parchment dark:bg-panel-dark">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-22">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
            Pricing
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            Free. All of it.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            Inkwell is free to use—no tiers, no subscription, no account. The full chapter-first
            writing workspace, formatting previews, and every export format (EPUB, print-ready PDF,
            DOCX, Markdown, plain text) are included. Your manuscripts live on your device: write in
            the browser or download the desktop app.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/app#bookshelf"
            className="inline-flex items-center justify-center rounded-full bg-ink px-7 py-3 text-base font-medium text-parchment shadow-sm transition hover:bg-walnut focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
          >
            Start writing free
          </a>
          {desktopDownloadUrl ?
            <a
              href={desktopDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-walnut/30 px-6 py-3 text-base font-medium text-ink transition hover:border-walnut/60 hover:bg-panel-light-muted/70 dark:border-border-dark dark:text-ink-dark dark:hover:border-accent-warm/45 dark:hover:bg-panel-dark/60"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Download for Windows
            </a>
          : null}
        </div>

        <TrustRow />
      </div>
    </section>
  )
}
