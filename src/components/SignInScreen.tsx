import { Moon, Sun } from 'lucide-react'
import { useCallback } from 'react'

type Props = {
  darkMode: boolean
  onToggleTheme: () => void
  /** Parent persists gate completion and navigates to the bookshelf. */
  onComplete: () => void
}

export function SignInScreen({ darkMode, onToggleTheme, onComplete }: Props) {
  const onContinue = useCallback(() => {
    onComplete()
  }, [onComplete])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-parchment text-ink transition-colors dark:bg-panel-dark dark:text-ink-dark">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-dust/70 px-4 py-4 sm:px-6 dark:border-border-dark/80">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-parchment dark:bg-cream dark:text-ink">
            🪶
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">Inkwell</h1>
            <p className="text-sm text-ink/60 dark:text-ink-dark/60">Local library on this device</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl border border-dust bg-white/70 text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/70 dark:text-ink-dark dark:hover:bg-panel-dark/90"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-12">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <p className="mb-10 text-sm leading-relaxed text-ink/75 dark:text-ink-dark/75 sm:mb-12 sm:text-base">
            No account or sign-in server — your manuscripts stay in this browser until you export. When you are ready,
            open your shelf and start a book or note.
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-3xl bg-ink px-10 py-3.5 text-base font-semibold text-parchment shadow-md ring-1 ring-ink/15 transition-[transform,box-shadow,background-color] hover:bg-walnut hover:shadow-lg active:scale-[0.98] dark:bg-cream dark:text-ink dark:ring-cream/25 dark:hover:bg-accent-warm sm:min-w-[14rem] sm:px-12 sm:py-4 sm:text-lg"
          >
            Enter Library
          </button>
        </div>
      </div>
    </div>
  )
}
