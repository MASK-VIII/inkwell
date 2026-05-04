import { Moon, Sun } from 'lucide-react'
import { useCallback, useState } from 'react'
import { InkwellEmblem } from './InkwellEmblem'

export type SignInCloudSyncProps = {
  sessionEmail: string | null
  cloudSignInBusy: boolean
  onSignInWithEmailPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onSignOutCloud?: () => void | Promise<void>
}

type Props = {
  darkMode: boolean
  onToggleTheme: () => void
  /** Parent persists gate completion and navigates to the bookshelf. */
  onComplete: () => void
  /** When set, optional Supabase email/password sign-in + continue offline. */
  cloudSync?: SignInCloudSyncProps
}

export function SignInScreen({ darkMode, onToggleTheme, onComplete, cloudSync }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const onContinue = useCallback(() => {
    onComplete()
  }, [onComplete])

  const onSubmit = useCallback(async () => {
    if (!cloudSync) return
    setFormError(null)
    const trimmed = email.trim()
    if (!trimmed.includes('@')) {
      setFormError('Enter a valid email address')
      return
    }
    if (!password) {
      setFormError('Enter your password')
      return
    }
    const r = await cloudSync.onSignInWithEmailPassword(trimmed, password)
    if (!r.ok) setFormError(r.error)
  }, [cloudSync, email, password])

  const hasSession = Boolean(cloudSync?.sessionEmail)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-parchment text-ink transition-colors dark:bg-panel-dark dark:text-ink-dark">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-dust/70 px-4 py-4 sm:px-6 dark:border-border-dark/80">
        <div className="group flex min-w-0 items-center gap-3">
          <InkwellEmblem size="signin" />
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">Inkwell</h1>
            <p className="text-sm text-ink/60 dark:text-ink-dark/60">
              {cloudSync ? 'Local library with optional cloud sync' : 'Local library on this device'}
            </p>
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
          {!cloudSync ? (
            <>
              <p className="mb-10 text-sm leading-relaxed text-ink/75 dark:text-ink-dark/75 sm:mb-12 sm:text-base">
                No account or sign-in server — your manuscripts stay in this browser until you export. When you are
                ready, open your shelf and start a book or note.
              </p>
              <button
                type="button"
                onClick={onContinue}
                className="rounded-3xl bg-ink px-10 py-3.5 text-base font-semibold text-parchment shadow-md ring-1 ring-ink/15 transition-[transform,box-shadow,background-color] hover:bg-walnut hover:shadow-lg active:scale-[0.98] dark:bg-cream dark:text-ink dark:ring-cream/25 dark:hover:bg-accent-warm sm:min-w-[14rem] sm:px-12 sm:py-4 sm:text-lg"
              >
                Enter Library
              </button>
            </>
          ) : hasSession ? (
            <>
              <p className="mb-6 text-sm leading-relaxed text-ink/75 dark:text-ink-dark/75 sm:text-base">
                Signed in for sync as{' '}
                <span className="font-medium text-ink dark:text-ink-dark">{cloudSync.sessionEmail}</span>.
              </p>
              <button
                type="button"
                onClick={onContinue}
                className="mb-4 rounded-3xl bg-ink px-10 py-3.5 text-base font-semibold text-parchment shadow-md ring-1 ring-ink/15 transition-[transform,box-shadow,background-color] hover:bg-walnut hover:shadow-lg active:scale-[0.98] dark:bg-cream dark:text-ink dark:ring-cream/25 dark:hover:bg-accent-warm sm:min-w-[14rem] sm:px-12 sm:py-4 sm:text-lg"
              >
                Enter Library
              </button>
              {cloudSync.onSignOutCloud ? (
                <button
                  type="button"
                  onClick={() => void cloudSync.onSignOutCloud?.()}
                  className="text-sm font-medium text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-200"
                >
                  Sign out of cloud sync
                </button>
              ) : null}
            </>
          ) : (
            <>
              <p className="mb-6 text-sm leading-relaxed text-ink/75 dark:text-ink-dark/75 sm:text-base">
                Continue on this device only, or sign in with the email and password for your Supabase user to sync
                your library across devices.
              </p>

              <form
                className="mb-8 w-full space-y-3 text-left"
                onSubmit={(e) => {
                  e.preventDefault()
                  void onSubmit()
                }}
              >
                <label className="block text-xs font-semibold uppercase tracking-wider text-walnut dark:text-accent-warm">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-dust bg-white px-4 py-3 text-sm text-ink shadow-inner outline-none ring-0 focus:border-walnut dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-accent-warm"
                />
                <label className="block text-xs font-semibold uppercase tracking-wider text-walnut dark:text-accent-warm">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-dust bg-white px-4 py-3 text-sm text-ink shadow-inner outline-none ring-0 focus:border-walnut dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus:border-accent-warm"
                />
                {formError ? <p className="text-sm text-red-700 dark:text-red-300">{formError}</p> : null}
                <button
                  type="submit"
                  disabled={cloudSync.cloudSignInBusy}
                  className="w-full rounded-2xl bg-ink py-3 text-sm font-semibold text-parchment transition-opacity hover:opacity-95 disabled:opacity-50 dark:bg-cream dark:text-ink"
                >
                  {cloudSync.cloudSignInBusy ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <button
                type="button"
                onClick={onContinue}
                className="mb-6 rounded-3xl border border-dust bg-white/80 px-8 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white dark:border-border-dark dark:bg-panel-dark/80 dark:text-ink-dark dark:hover:bg-panel-dark"
              >
                Continue offline (no cloud sync)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
