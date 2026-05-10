import { Download, Moon, ShoppingBag, Sun } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { getInkwellDesktopDownloadUrl } from '../lib/marketing/desktopDownloadUrl'
import { InkwellEmblem } from './InkwellEmblem'
import { InkwellProfileMenu, type InkwellProfileMenuProps } from './InkwellProfileMenu'
import { InkwellWordmark } from './InkwellWordmark'
import { useThemeShine } from './useThemeShine'

export type SignInCloudSyncProps = {
  sessionEmail: string | null
  cloudSignInBusy: boolean
  onSignInWithEmailPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  onSignUpWithEmailPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; needsEmailConfirmation: boolean } | { ok: false; error: string }>
  onRequestPasswordResetEmail: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>
  onSignOutCloud?: () => void | Promise<void>
  /** When active, user arrived via password-reset link and must set a new password. */
  passwordRecovery: {
    busy: boolean
    onSubmitNewPassword: (password: string) => Promise<{ ok: true } | { ok: false; error: string }>
  } | null
}

type Props = {
  darkMode: boolean
  onToggleTheme: () => void
  /** Parent persists gate completion and navigates to the bookshelf. */
  onComplete: () => void
  /** When set, optional Supabase email/password sign-in + continue offline. */
  cloudSync?: SignInCloudSyncProps
  profileMenu?: InkwellProfileMenuProps
  /**
   * Initial auth tab when the user has not interacted yet. Defaults to 'signin'.
   * Set to 'signup' on Buy Now / pending-checkout entry so first-time buyers land on Create account.
   */
  initialMode?: 'signin' | 'signup'
  /**
   * When set, a small trust-pill is rendered above the auth tabs to remind the user what they
   * are about to buy (e.g. `Buying Inkwell Basic — $49 USD`). Computed by App.tsx from the
   * fresh `?checkout=` query.
   */
  pendingPurchaseLabel?: string
}

type AuthMode = 'signin' | 'signup' | 'forgot'

/** Last email used on this device when “Remember username” was enabled (sign-in only). */
export const REMEMBERED_SIGNIN_EMAIL_KEY = 'inkwell-signin-remembered-email'

const inputClassName =
  'w-full rounded-xl border border-dust/90 bg-panel-light-strong px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none transition-shadow focus-visible:border-walnut focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark dark:shadow-inner dark:focus-visible:border-accent-warm dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark'

const labelClassName = 'text-sm font-medium text-ink-muted dark:text-ink-dark/65'

export function SignInScreen({
  darkMode,
  onToggleTheme,
  onComplete,
  cloudSync,
  profileMenu,
  initialMode,
  pendingPurchaseLabel,
}: Props) {
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(REMEMBERED_SIGNIN_EMAIL_KEY) ?? ''
  })
  const [rememberUsername, setRememberUsername] = useState(() => {
    if (typeof window === 'undefined') return false
    const raw = localStorage.getItem(REMEMBERED_SIGNIN_EMAIL_KEY)
    return raw != null && raw !== ''
  })
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [mode, setMode] = useState<AuthMode>(initialMode ?? 'signin')
  const brandRef = useRef<HTMLButtonElement>(null)
  useThemeShine(brandRef)

  const isDesktopShell = typeof window !== 'undefined' && Boolean(window.inkwellDesktop)

  const goToMarketingHome = useCallback(() => {
    if (typeof window === 'undefined' || isDesktopShell) return
    const base = import.meta.env.BASE_URL || '/'
    const path = base.endsWith('/') ? base.slice(0, -1) || '/' : base
    window.location.assign(path === '/' ? '/' : `${path}/`)
  }, [isDesktopShell])
  const desktopDownloadUrl = getInkwellDesktopDownloadUrl()
  const showDesktopDownload = !isDesktopShell && desktopDownloadUrl != null

  const onContinue = useCallback(() => {
    onComplete()
  }, [onComplete])

  const onSubmitSignIn = useCallback(async () => {
    if (!cloudSync) return
    setFormError(null)
    setAuthNotice(null)
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
    if (!r.ok) {
      setFormError(r.error)
      return
    }
    if (rememberUsername) localStorage.setItem(REMEMBERED_SIGNIN_EMAIL_KEY, trimmed)
    else localStorage.removeItem(REMEMBERED_SIGNIN_EMAIL_KEY)
  }, [cloudSync, email, password, rememberUsername])

  const onSubmitSignUp = useCallback(async () => {
    if (!cloudSync) return
    setFormError(null)
    setAuthNotice(null)
    const trimmed = email.trim()
    if (!trimmed.includes('@')) {
      setFormError('Enter a valid email address')
      return
    }
    if (password.length < 8) {
      setFormError('Use at least 8 characters for your password')
      return
    }
    if (password !== passwordConfirm) {
      setFormError('Passwords do not match')
      return
    }
    const r = await cloudSync.onSignUpWithEmailPassword(trimmed, password)
    if (!r.ok) {
      setFormError(r.error)
      return
    }
    if (r.needsEmailConfirmation) {
      setAuthNotice('Check your email to confirm your account, then sign in here.')
      setMode('signin')
      setPassword('')
      setPasswordConfirm('')
      return
    }
  }, [cloudSync, email, password, passwordConfirm])

  const onSubmitForgot = useCallback(async () => {
    if (!cloudSync) return
    setFormError(null)
    setAuthNotice(null)
    const trimmed = email.trim()
    if (!trimmed.includes('@')) {
      setFormError('Enter a valid email address')
      return
    }
    const r = await cloudSync.onRequestPasswordResetEmail(trimmed)
    if (!r.ok) {
      setFormError(r.error)
      return
    }
    setAuthNotice('If that email is registered, you will receive a reset link shortly.')
    setMode('signin')
  }, [cloudSync, email])

  const onSubmitRecovery = useCallback(async () => {
    if (!cloudSync?.passwordRecovery) return
    setFormError(null)
    if (password.length < 8) {
      setFormError('Use at least 8 characters for your password')
      return
    }
    if (password !== passwordConfirm) {
      setFormError('Passwords do not match')
      return
    }
    const r = await cloudSync.passwordRecovery.onSubmitNewPassword(password)
    if (!r.ok) setFormError(r.error)
    else {
      setPassword('')
      setPasswordConfirm('')
    }
  }, [cloudSync, password, passwordConfirm])

  const hasSession = Boolean(cloudSync?.sessionEmail)
  const recoveryActive = Boolean(cloudSync?.passwordRecovery)

  const heroTitle = (() => {
    if (!cloudSync) return 'Welcome'
    if (recoveryActive) return 'New password'
    if (hasSession) return 'Welcome back'
    if (mode === 'forgot') return 'Reset password'
    return 'Welcome'
  })()

  const heroSubtitleEl = (() => {
    if (!cloudSync) {
      return (
        <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-ink/65 dark:text-ink-dark/65 sm:text-[0.9375rem]">
          Your work stays on this device until you export. Open the app when you are ready.
        </p>
      )
    }
    if (recoveryActive && cloudSync.passwordRecovery) {
      return (
        <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-ink/65 dark:text-ink-dark/65 sm:text-[0.9375rem]">
          Choose a new password for{' '}
          <span className="font-medium text-ink dark:text-ink-dark">{cloudSync.sessionEmail ?? 'your account'}</span>.
        </p>
      )
    }
    if (hasSession) {
      return (
        <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-ink/65 dark:text-ink-dark/65 sm:text-[0.9375rem]">
          Signed in for sync as{' '}
          <span className="font-medium text-ink dark:text-ink-dark">{cloudSync.sessionEmail}</span>.
        </p>
      )
    }
    if (mode === 'forgot') {
      return (
        <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-ink/65 dark:text-ink-dark/65 sm:text-[0.9375rem]">
          We will email you a link if this address is registered.
        </p>
      )
    }
    if (mode === 'signup') {
      return (
        <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-ink/65 dark:text-ink-dark/65 sm:text-[0.9375rem]">
          Create an account to sync your work across devices.
        </p>
      )
    }
    return (
      <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-ink/65 dark:text-ink-dark/65 sm:text-[0.9375rem]">
        Sign in to sync across devices, or continue offline.
      </p>
    )
  })()

  return (
    <div className="inkwell-signin-canvas flex min-h-0 flex-1 flex-col text-ink transition-colors dark:text-ink-dark">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-dust/35 bg-panel-light-strong/88 px-4 py-3 backdrop-blur-md sm:px-6 dark:border-border-dark/60 dark:bg-panel-dark/80">
        <button
          ref={brandRef}
          type="button"
          className="inkwell-header-brand group inline-flex w-fit max-w-full min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark sm:gap-3"
          aria-label="Inkwell — back to home"
          title="Back to home"
          onClick={goToMarketingHome}
        >
          <InkwellEmblem darkMode={darkMode} />
          <InkwellWordmark as="span" className="min-w-0" />
        </button>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inkwell-btn-icon"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {profileMenu ? <InkwellProfileMenu {...profileMenu} /> : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8 sm:py-16">
        <div className="inkwell-signin-hero flex w-full max-w-[420px] flex-col items-center text-center">
          <div className="mb-8 w-full sm:mb-10">
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-ink dark:text-ink-dark sm:text-[1.625rem]">
              {heroTitle}
            </h1>
            {heroSubtitleEl}
            {pendingPurchaseLabel && !recoveryActive ?
              <div className="mt-5 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-walnut/25 bg-walnut/10 px-3.5 py-1.5 text-xs font-medium text-ink shadow-sm dark:border-accent-warm/35 dark:bg-accent-warm/15 dark:text-ink-dark">
                  <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
                  {pendingPurchaseLabel}
                </span>
              </div>
            : null}
          </div>

          {showDesktopDownload && desktopDownloadUrl ? (
            <div className="mb-8 w-full max-w-sm">
              <a
                href={desktopDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inkwell-hub-secondary inline-flex w-full items-center justify-center gap-2"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                Download desktop app
              </a>
            </div>
          ) : null}

          {!cloudSync ? (
            <button type="button" onClick={onContinue} className="inkwell-hub-primary sm:min-w-[14rem]">
              Enter Library
            </button>
          ) : recoveryActive && cloudSync.passwordRecovery ? (
            <div className="inkwell-signin-form-card w-full">
              <form
                className="flex w-full flex-col gap-4 text-left"
                onSubmit={(e) => {
                  e.preventDefault()
                  void onSubmitRecovery()
                }}
              >
                <label className={labelClassName}>New password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClassName}
                />
                <label className={labelClassName}>Confirm password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={inputClassName}
                />
                {formError ? <p className="inkwell-signin-error">{formError}</p> : null}
                <button
                  type="submit"
                  disabled={cloudSync.passwordRecovery.busy}
                  className="inkwell-hub-primary w-full"
                >
                  {cloudSync.passwordRecovery.busy ? 'Updating…' : 'Save new password'}
                </button>
              </form>
            </div>
          ) : hasSession ? (
            <div className="flex w-full max-w-sm flex-col items-center gap-4">
              <button type="button" onClick={onContinue} className="inkwell-hub-primary w-full sm:min-w-[14rem]">
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
            </div>
          ) : (
            <div className="flex w-full flex-col items-center">
              {authNotice ?
                <p
                  role="status"
                  className="mb-5 max-w-sm text-pretty text-sm leading-relaxed text-walnut dark:text-accent-warm"
                >
                  {authNotice}
                </p>
              : null}

              <div className="w-full max-w-sm">
                {mode === 'forgot' ? (
                  <button
                    type="button"
                    className="mb-5 text-sm font-medium text-walnut underline decoration-dotted underline-offset-2 hover:opacity-90 dark:text-accent-warm"
                    onClick={() => {
                      setMode('signin')
                      setFormError(null)
                      setAuthNotice(null)
                    }}
                  >
                    ← Back to sign in
                  </button>
                ) : (
                  <div
                    className={`inkwell-signin-mode-switch mb-6${mode === 'signup' ? ' inkwell-signin-mode-switch--signup' : ''}`}
                    role="tablist"
                    aria-label="Account"
                  >
                    <span className="inkwell-signin-mode-switch-thumb" aria-hidden />
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'signin'}
                      className={`inkwell-signin-mode-switch-tab ${mode === 'signin' ? 'inkwell-signin-mode-switch-tab--active' : 'inkwell-signin-mode-switch-tab--inactive'}`}
                      onClick={() => {
                        setMode('signin')
                        setFormError(null)
                      }}
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'signup'}
                      className={`inkwell-signin-mode-switch-tab ${mode === 'signup' ? 'inkwell-signin-mode-switch-tab--active' : 'inkwell-signin-mode-switch-tab--inactive'}`}
                      onClick={() => {
                        setMode('signup')
                        setFormError(null)
                        setAuthNotice(null)
                      }}
                    >
                      Create account
                    </button>
                  </div>
                )}

                <div className="inkwell-signin-form-card">
                  <form
                    className="flex w-full flex-col gap-4 text-left"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (mode === 'signin') void onSubmitSignIn()
                      else if (mode === 'signup') void onSubmitSignUp()
                      else void onSubmitForgot()
                    }}
                  >
                    <label className={labelClassName}>Email</label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClassName}
                    />
                    {mode === 'forgot' ? null : (
                      <>
                        <label className={labelClassName}>Password</label>
                        <input
                          type="password"
                          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className={inputClassName}
                        />
                      </>
                    )}
                    {mode === 'signup' ? (
                      <>
                        <label className={labelClassName}>Confirm password</label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="••••••••"
                          className={inputClassName}
                        />
                      </>
                    ) : null}
                    {mode === 'signin' ? (
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <label className="flex min-w-0 cursor-pointer select-none items-center gap-2.5 text-sm text-ink/85 dark:text-ink-dark/85">
                          <input
                            type="checkbox"
                            checked={rememberUsername}
                            onChange={(e) => {
                              const on = e.target.checked
                              setRememberUsername(on)
                              if (!on) localStorage.removeItem(REMEMBERED_SIGNIN_EMAIL_KEY)
                            }}
                            className="h-4 w-4 shrink-0 rounded border border-dust text-walnut focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:border-border-dark dark:text-accent-warm dark:focus-visible:ring-cream/50 dark:focus-visible:ring-offset-panel-dark"
                          />
                          Remember username
                        </label>
                        <button
                          type="button"
                          className="shrink-0 text-sm font-medium text-walnut underline decoration-dotted underline-offset-2 hover:opacity-90 dark:text-accent-warm"
                          onClick={() => {
                            setMode('forgot')
                            setFormError(null)
                            setAuthNotice(null)
                          }}
                        >
                          Forgot password?
                        </button>
                      </div>
                    ) : null}
                    {formError ? <p className="inkwell-signin-error">{formError}</p> : null}
                    <button type="submit" disabled={cloudSync.cloudSignInBusy} className="inkwell-hub-primary w-full">
                      {cloudSync.cloudSignInBusy ?
                        mode === 'signin' ?
                          'Signing in…'
                        : mode === 'signup' ?
                          'Creating account…'
                        : 'Sending…'
                      : mode === 'signin' ?
                        'Sign in'
                      : mode === 'signup' ?
                        'Create account'
                      : 'Send reset link'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-8 w-full max-w-sm border-t border-dust/45 pt-8 dark:border-border-dark/45">
                <button type="button" onClick={onContinue} className="inkwell-hub-secondary w-full">
                  Continue offline (no cloud sync)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
