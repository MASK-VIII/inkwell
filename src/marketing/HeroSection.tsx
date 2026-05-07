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
            Draft. Format. Publish.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-walnut/90 dark:text-ink-dark/82">
            Chapters, drafts, revisions, and notes stay together in a calm, type-led workspace that is easy to pick up when you are starting out, and deep enough for authors who already live in manuscripts. Start writing locally for free with no sign-up—open the app and go.
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
              className="inline-flex items-center justify-center rounded-full border border-walnut/30 px-6 py-3 text-base font-medium text-ink transition hover:border-walnut/60 hover:bg-white/60 dark:border-border-dark dark:text-ink-dark dark:hover:border-accent-warm/45 dark:hover:bg-panel-dark/60"
            >
              See pricing
            </a>
          </div>
          <p className="text-xs text-walnut/65 dark:text-ink-dark/68">
            Free forever on your device—no credit card, no account required to begin. Basic adds cloud backup and EPUB; Pro adds the full export suite for print and submissions (sign in when you upgrade).
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
