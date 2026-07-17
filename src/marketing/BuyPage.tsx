import { Download } from 'lucide-react'
import { getInkwellDesktopDownloadUrl } from '../lib/marketing/desktopDownloadUrl'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import { useMarketingDarkMode } from './useMarketingDarkMode'
import { useMarketingPageHead } from './useMarketingPageHead'

/**
 * Legacy `/buy` URL. Inkwell is free now, so this page simply says so and points
 * at the app and the desktop download (old links and bookmarks keep working).
 */
export function BuyPage() {
  const { darkMode, toggle } = useMarketingDarkMode()
  const desktopDownloadUrl = getInkwellDesktopDownloadUrl()

  useMarketingPageHead({
    title: 'Inkwell is free',
    canonicalPath: '/buy',
    ogTitle: 'Inkwell is free',
    metaDescription:
      'Inkwell is free to use: the full local-first writing workspace and every export format (EPUB, PDF, DOCX, Markdown) with no account and no subscription.',
    ogDescription:
      'Inkwell is free: chapter-first novel writing, formatting previews, and the full export suite—local on your device, in the browser or the desktop app.',
  })

  return (
    <main className="marketing-landing min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav darkMode={darkMode} onToggleDarkMode={toggle} showAnchors={false} />

      <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
          Good news
        </p>
        <h1 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
          Inkwell is free.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
          There is nothing to buy: the full chapter-first writing workspace, formatting previews,
          and every export format (EPUB, print-ready PDF, DOCX, Markdown, plain text) are included.
          No account, no subscription. Your manuscripts stay on your device.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
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
      </section>

      <MarketingFooter />
    </main>
  )
}

export default BuyPage
