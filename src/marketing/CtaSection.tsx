export function CtaSection() {
  return (
    <section className="border-t border-dust/60 bg-gradient-to-b from-white/40 via-parchment to-parchment dark:border-border-dark/80 dark:from-panel-dark/30 dark:via-panel-dark dark:to-panel-dark">
      <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8">
        <h2 className="font-serif text-3xl leading-[1.1] text-ink sm:text-4xl dark:text-ink-dark">
          Ready to write?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-walnut/85 dark:text-ink-dark/70">
          Open Inkwell and start a manuscript in under a minute. Your work stays yours, your draft stays close, and the page is already waiting.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="/app"
            className="inline-flex items-center justify-center rounded-full bg-ink px-7 py-3 text-base font-medium text-parchment shadow-sm transition hover:bg-walnut focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
          >
            Open Inkwell
          </a>
          <a
            href="mailto:inkwell@enterthelimelight.com"
            className="inline-flex items-center justify-center rounded-full border border-walnut/30 px-6 py-3 text-base font-medium text-ink transition hover:border-walnut/60 hover:bg-white/60 dark:border-border-dark dark:text-ink-dark dark:hover:border-accent-warm/45 dark:hover:bg-panel-dark/60"
          >
            Say hello
          </a>
        </div>
      </div>
    </section>
  )
}
