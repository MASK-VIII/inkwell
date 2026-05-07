export function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-dust/60 bg-parchment dark:border-border-dark/80 dark:bg-panel-dark">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-serif text-lg text-ink dark:text-ink-dark">Inkwell</p>
            <p className="mt-2 text-sm leading-relaxed text-walnut/80 dark:text-ink-dark/80">
              Draft, format, publish—chapter-first writing for new authors and seasoned novelists. Beta.
            </p>
          </div>

          <nav aria-label="Product" className="text-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-walnut/85 dark:text-ink-dark/80">
              <li>
                <a
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="#features"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="#how-it-works"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="#faq"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="/app#bookshelf"
                >
                  Start free (no signup)
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal" className="text-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">Legal</p>
            <ul className="mt-3 space-y-2 text-walnut/85 dark:text-ink-dark/80">
              <li>
                <a
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="/privacy"
                >
                  Privacy
                </a>
              </li>
              <li>
                <a
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="/terms"
                >
                  Terms
                </a>
              </li>
              <li>
                <a
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="/refund"
                >
                  Refunds
                </a>
              </li>
            </ul>
          </nav>

          <div className="text-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">Contact</p>
            <ul className="mt-3 space-y-2 text-walnut/85 dark:text-ink-dark/80">
              <li>
                <a
                  className="rounded-sm font-medium underline decoration-walnut/45 underline-offset-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:decoration-accent-warm/50 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="mailto:contact@enterthelimelight.com"
                >
                  contact@enterthelimelight.com
                </a>
                <span className="mt-0.5 block text-xs text-walnut/65 dark:text-ink-dark/55">General</span>
              </li>
              <li>
                <a
                  className="rounded-sm font-medium underline decoration-walnut/45 underline-offset-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:decoration-accent-warm/50 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="mailto:support@enterthelimelight.com"
                >
                  support@enterthelimelight.com
                </a>
                <span className="mt-0.5 block text-xs text-walnut/65 dark:text-ink-dark/55">Help &amp; billing</span>
              </li>
              <li>
                <a
                  className="rounded-sm font-medium underline decoration-walnut/45 underline-offset-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:decoration-accent-warm/50 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="https://enterthelimelight.com"
                >
                  enterthelimelight.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-dust/60 pt-6 text-xs text-walnut/70 sm:flex-row sm:items-center sm:justify-between dark:border-border-dark/80 dark:text-ink-dark/70">
          <p>&copy; {year} Inkwell. Part of enterthelimelight.com.</p>
          <p>Made for the whole arc of a book—not just the opening line.</p>
        </div>
      </div>
    </footer>
  )
}
