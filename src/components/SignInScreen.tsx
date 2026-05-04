import { Moon, Sun } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { InkwellEmblem } from './InkwellEmblem'
import { InkwellWordmark } from './InkwellWordmark'
import { useThemeShine } from './useThemeShine'

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

const inputClassName =
  'w-full rounded-2xl border border-dust bg-white px-4 py-3 text-sm text-ink shadow-inner outline-none transition-shadow focus-visible:border-walnut focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:focus-visible:border-accent-warm dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark'

export function SignInScreen({ darkMode, onToggleTheme, onComplete, cloudSync }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const brandRef = useRef<HTMLButtonElement>(null)
  useThemeShine(brandRef)

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
    <div className="inkwell-signin-canvas flex min-h-0 flex-1 flex-col text-ink transition-colors dark:text-ink-dark">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-dust/70 px-4 py-4 sm:px-6 dark:border-border-dark/80">
        <button
          ref={brandRef}
          type="button"
          className="inkwell-header-brand group inline-flex w-fit max-w-full min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark sm:gap-3"
          aria-label="Inkwell"
          title="Inkwell"
          onClick={() => {}}
        >
          <InkwellEmblem darkMode={darkMode} />
          <InkwellWordmark as="span" className="min-w-0" />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="inkwell-btn-icon"
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-12">
        <div className="inkwell-signin-hero flex w-full max-w-md flex-col items-center text-center">
          <h1 className="mb-3 font-serif text-xl font-semibold tracking-tight text-ink dark:text-ink-dark sm:text-2xl">
            Your library
          </h1>

          {!cloudSync ? (
            <>
              <p className="mb-10 max-w-sm text-pretty text-sm leading-relaxed text-ink/75 dark:text-ink-dark/75 sm:mb-12 sm:text-base">
                No account or sign-in server — your manuscripts stay in this browser until you export. When you are
                ready, open your shelf and start a book or note.
              </p>
              <button type="button" onClick={onContinue} className="inkwell-hub-primary sm:min-w-[14rem]">
                Enter Library
              </button>
            </>
          ) : hasSession ? (
            <>
              <p className="mb-6 max-w-sm text-pretty text-sm leading-relaxed text-ink/75 dark:text-ink-dark/75 sm:text-base">
                Signed in for sync as{' '}
                <span className="font-medium text-ink dark:text-ink-dark">{cloudSync.sessionEmail}</span>.
              </p>
              <button type="button" onClick={onContinue} className="inkwell-hub-primary mb-4 sm:min-w-[14rem]">
                Enter Library
              </button>
              {cloudSync.onSignOutCloud ? (
                <button
                  type="button"
                  onClick={() => void cloudSync.onSignOutCloud?.()}
                  className="text-sm font-medium text-walnut underline decoration-dotted underline-offset-2 hover:opacity-90 dark:text-accent-warm dark:hover:text-ink-dark"
                >
                  Sign out of cloud sync
                </button>
              ) : null}
            </>
          ) : (
            <>
              <p className="mb-6 max-w-sm text-pretty text-sm leading-relaxed text-ink/75 dark:text-ink-dark/75 sm:text-base">
                Continue on this device only, or sign in with the email and password for your Supabase user to sync
                your library across devices.
              </p>

              <div className="inkwell-signin-form-card">
                <form
                  className="flex w-full flex-col gap-3 text-left"
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
                    className={inputClassName}
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
                    className={inputClassName}
                  />
                  {formError ? <p className="inkwell-signin-error">{formError}</p> : null}
                  <button type="submit" disabled={cloudSync.cloudSignInBusy} className="inkwell-hub-primary w-full">
                    {cloudSync.cloudSignInBusy ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              </div>

              <button type="button" onClick={onContinue} className="inkwell-hub-secondary mb-6 w-full">
                Continue offline (no cloud sync)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
