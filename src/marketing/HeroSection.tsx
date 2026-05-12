import { Download } from 'lucide-react'
import { getInkwellDesktopDownloadUrl } from '../lib/marketing/desktopDownloadUrl'
import { MarketingScreenshot } from './MarketingScreenshot'

export function HeroSection({ darkMode = false }: { darkMode?: boolean }) {
  const desktopDownloadUrl = getInkwellDesktopDownloadUrl()

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-parchment via-parchment to-white/60 dark:from-panel-dark dark:via-panel-dark dark:to-panel-dark/70"
        aria-hidden
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:gap-14 sm:px-8 sm:py-28 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="flex flex-col gap-7">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
            Inkwell 1.0
          </p>
          <h1 className="font-serif text-4xl leading-[1.05] text-ink sm:text-5xl lg:text-6xl dark:text-ink-dark">
            Draft. Format. Publish.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-walnut/90 dark:text-ink-dark/82">
            A local-first workspace for long-form fiction: stay in the draft, preview print and ebook layouts, then export—without stacking another subscription.
          </p>
          <ul className="max-w-xl space-y-2 text-base leading-relaxed text-walnut/90 dark:text-ink-dark/82">
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-walnut/50 dark:bg-accent-warm/70" aria-hidden />
              <span>
                <span className="font-medium text-ink dark:text-ink-dark">Start free, no signup</span>
                —full chapter-first writing on your device until you choose paid cloud or exports.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-walnut/50 dark:bg-accent-warm/70" aria-hidden />
              <span>
                <span className="font-medium text-ink dark:text-ink-dark">Basic</span>
                —sync + backup + EPUB when you are ready to publish digitally.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-walnut/50 dark:bg-accent-warm/70" aria-hidden />
              <span>
                <span className="font-medium text-ink dark:text-ink-dark">Pro (intro pricing)</span>
                —full export suite and deeper formatting for print and submissions.
              </span>
            </li>
          </ul>
          <p className="max-w-xl text-sm leading-relaxed text-walnut/78 dark:text-ink-dark/70">
            Inkwell 1.0 is built and supported by one person—human support, fast fixes when edge cases show up, and a 30-day refund on paid tiers if it is not the right fit.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="/app#bookshelf"
              className="inline-flex items-center justify-center rounded-full bg-ink px-7 py-3 text-base font-medium text-parchment shadow-sm transition hover:bg-walnut focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
            >
              Start writing free
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full border border-walnut/30 px-6 py-3 text-base font-medium text-ink transition hover:border-walnut/60 hover:bg-panel-light-muted/70 dark:border-border-dark dark:text-ink-dark dark:hover:border-accent-warm/45 dark:hover:bg-panel-dark/60"
            >
              See pricing
            </a>
          </div>
          <p className="text-xs text-walnut/65 dark:text-ink-dark/68">
            Free is local-only. Basic adds cloud backup + EPUB. Pro adds full exports. Paid tiers include lifetime updates
            and a 30-day refund if Inkwell is not the right fit (
            <a
              href="/refund"
              className="font-medium text-ink underline decoration-walnut/35 underline-offset-2 hover:decoration-walnut/55 dark:text-ink-dark dark:decoration-cream/35 dark:hover:decoration-cream/55"
            >
              details
            </a>
            ).
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:gap-6 lg:pl-4">
          {desktopDownloadUrl ?
            <div className="flex justify-center lg:justify-end">
              <a
                href={desktopDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl border border-walnut/35 bg-panel-light/88 px-6 py-3.5 text-base font-semibold text-ink shadow-sm backdrop-blur-sm transition hover:border-walnut/55 hover:bg-panel-light-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut sm:w-auto lg:max-w-none dark:border-border-dark dark:bg-panel-dark/75 dark:text-ink-dark dark:hover:border-accent-warm/45 dark:hover:bg-panel-dark/90 dark:focus-visible:outline-cream/50"
              >
                <Download className="h-5 w-5 shrink-0" aria-hidden />
                Download app
              </a>
            </div>
          : null}
          <MarketingScreenshot
            src="/marketing/chapter-in-progress-light.png"
            darkSrc="/marketing/chapter-in-progress-dark.png"
            darkMode={darkMode}
            alt="Inkwell editor with chapter list and an open chapter in the manuscript"
            caption={'Inkwell \u2014 a chapter in progress'}
            aspectRatio="3 / 2"
            objectPosition="50% 12%"
          />
        </div>
      </div>
    </section>
  )
}
