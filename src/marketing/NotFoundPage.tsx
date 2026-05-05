import { useEffect } from 'react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import { useMarketingDarkMode } from './useMarketingDarkMode'

export function NotFoundPage() {
  const { darkMode, toggle } = useMarketingDarkMode()

  useEffect(() => {
    document.title = 'Page not found \u2014 Inkwell'
    return () => {
      document.title = 'Inkwell'
    }
  }, [])

  return (
    <main className="flex min-h-screen flex-col bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav showAnchors={false} darkMode={darkMode} onToggleDarkMode={toggle} />
      <section className="flex flex-1 items-center justify-center px-5 py-24 sm:px-8">
        <div className="max-w-lg text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">404</p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.1] text-ink sm:text-5xl dark:text-ink-dark">
            That page is not here.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-walnut/90 dark:text-ink-dark/80">
            The link may be old or mistyped. Inkwell is happy to take you home.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment transition hover:bg-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
            >
              Back to the homepage
            </a>
            <a
              href="/app"
              className="inline-flex items-center justify-center rounded-full border border-walnut/30 px-6 py-3 text-sm font-medium text-ink transition hover:border-walnut/60 dark:border-border-dark dark:text-ink-dark dark:hover:border-accent-warm/45"
            >
              Open Inkwell
            </a>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  )
}
