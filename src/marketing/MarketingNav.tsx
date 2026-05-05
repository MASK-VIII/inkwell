import { Moon, Sun } from 'lucide-react'
import { InkwellEmblem } from '../components/InkwellEmblem'
import { InkwellWordmark } from '../components/InkwellWordmark'

type Props = {
  /** When true, anchor links (Features, FAQ) are shown. Hidden on legal pages. */
  showAnchors?: boolean
  darkMode: boolean
  onToggleDarkMode: () => void
}

export function MarketingNav({ showAnchors = true, darkMode, onToggleDarkMode }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-dust/60 bg-parchment/90 backdrop-blur-sm dark:border-border-dark/80 dark:bg-panel-dark/70">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <a href="/" className="group flex items-center gap-3 outline-none">
          <InkwellEmblem darkMode={darkMode} className="h-9 w-9" />
          <InkwellWordmark className="!text-[1.5rem] sm:!text-[1.75rem]" />
        </a>

        <div className="flex items-center gap-2 sm:gap-6">
          {showAnchors && (
            <ul className="hidden items-center gap-6 text-sm text-walnut/85 md:flex dark:text-ink-dark/85">
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
                  href="#pricing"
                >
                  Pricing
                </a>
              </li>
              <li>
                <a
                  className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/35 dark:hover:text-cream dark:focus-visible:ring-cream/40"
                  href="/changelog"
                >
                  Changelog
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
            </ul>
          )}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dust/70 bg-white/50 text-ink shadow-sm transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut dark:border-border-dark dark:bg-panel-dark/60 dark:text-ink-dark dark:hover:bg-panel-dark/80"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <a
            href="/app"
            className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2 text-sm font-medium text-parchment shadow-sm transition hover:bg-walnut focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
          >
            Open Inkwell
          </a>
        </div>
      </nav>
    </header>
  )
}
