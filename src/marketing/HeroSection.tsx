import { MarketingScreenshot } from './MarketingScreenshot'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-parchment via-parchment to-white/60 dark:from-panel-dark dark:via-panel-dark dark:to-panel-dark/70"
        aria-hidden
      />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="flex flex-col gap-7">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
            Inkwell &nbsp;&middot;&nbsp; in beta
          </p>
          <h1 className="font-serif text-4xl leading-[1.05] text-ink sm:text-5xl lg:text-6xl dark:text-ink-dark">
            A workspace built for the long form.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-walnut/90 dark:text-ink-dark/70">
            Inkwell is where your novel lives. Chapters, drafts, revisions, and the small editorial decisions that turn a manuscript into a book, all kept together in a quiet, type-driven workspace.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="/app"
              className="inline-flex items-center justify-center rounded-full bg-ink px-7 py-3 text-base font-medium text-parchment shadow-sm transition hover:bg-walnut focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
            >
              Start writing free
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full border border-walnut/30 px-6 py-3 text-base font-medium text-ink transition hover:border-walnut/60 hover:bg-white/60 dark:border-border-dark dark:text-ink-dark dark:hover:border-accent-warm/45 dark:hover:bg-panel-dark/60"
            >
              See pricing
            </a>
          </div>
          <p className="text-xs text-walnut/65 dark:text-ink-dark/55">
            Free forever. No credit card. Local-only library on Free; Basic adds cloud backup and EPUB when you upgrade.
          </p>
        </div>

        <div className="lg:pl-4">
          <MarketingScreenshot
            src="/marketing/hero.png"
            alt="The Inkwell editor with a chapter open"
            caption={'Inkwell \u2014 a chapter in progress'}
            aspectRatio="4 / 3"
          />
        </div>
      </div>
    </section>
  )
}
