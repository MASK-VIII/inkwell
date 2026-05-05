export function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-dust/60 bg-parchment dark:border-border-dark/80 dark:bg-panel-dark">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-serif text-lg text-ink dark:text-ink-dark">Inkwell</p>
            <p className="mt-2 text-sm leading-relaxed text-walnut/80 dark:text-ink-dark/70">
              A workspace built for the long form. Beta.
            </p>
          </div>

          <nav aria-label="Product" className="text-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-walnut/85 dark:text-ink-dark/75">
              <li>
                <a className="hover:text-ink" href="#features">
                  Features
                </a>
              </li>
              <li>
                <a className="hover:text-ink" href="#how-it-works">
                  How it works
                </a>
              </li>
              <li>
                <a className="hover:text-ink" href="#faq">
                  FAQ
                </a>
              </li>
              <li>
                <a className="hover:text-ink" href="/app">
                  Open the app
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal" className="text-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">Legal</p>
            <ul className="mt-3 space-y-2 text-walnut/85 dark:text-ink-dark/75">
              <li>
                <a className="hover:text-ink" href="/privacy">
                  Privacy
                </a>
              </li>
              <li>
                <a className="hover:text-ink" href="/terms">
                  Terms
                </a>
              </li>
              <li>
                <a className="hover:text-ink" href="/refund">
                  Refunds
                </a>
              </li>
            </ul>
          </nav>

          <div className="text-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">Contact</p>
            <ul className="mt-3 space-y-2 text-walnut/85 dark:text-ink-dark/75">
              <li>
                <a className="hover:text-ink" href="mailto:support@enterthelimelight.com">
                  support@enterthelimelight.com
                </a>
              </li>
              <li>
                <a className="hover:text-ink" href="https://enterthelimelight.com">
                  enterthelimelight.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-dust/60 pt-6 text-xs text-walnut/70 sm:flex-row sm:items-center sm:justify-between dark:border-border-dark/80 dark:text-ink-dark/60">
          <p>&copy; {year} Inkwell. Part of enterthelimelight.com.</p>
          <p>Made for writers, slowly and on purpose.</p>
        </div>
      </div>
    </footer>
  )
}
