import { useEffect, type ReactNode } from 'react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import { useMarketingDarkMode } from './useMarketingDarkMode'

type Props = {
  title: string
  /** Plain document title used for the browser tab. */
  pageTitle: string
  lastUpdated: string
  children: ReactNode
}

export function LegalPage({ title, pageTitle, lastUpdated, children }: Props) {
  const { darkMode, toggle } = useMarketingDarkMode()

  useEffect(() => {
    document.title = pageTitle
    return () => {
      document.title = 'Inkwell'
    }
  }, [pageTitle])

  return (
    <main className="min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav showAnchors={false} darkMode={darkMode} onToggleDarkMode={toggle} />
      <article className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/70">
          {lastUpdated}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.1] text-ink sm:text-5xl dark:text-ink-dark">{title}</h1>
        <div
          className={[
            'prose prose-sm mt-10 max-w-none text-walnut/90 dark:text-ink-dark/90',
            '[&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ink [&_h2]:dark:text-ink-dark',
            '[&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:text-ink [&_h3]:dark:text-ink-dark',
            '[&_p]:mt-4 [&_p]:leading-relaxed',
            '[&_strong]:text-ink [&_strong]:dark:text-ink-dark',
            '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1 [&_li]:marker:text-walnut/60 [&_li]:dark:marker:text-ink-dark/50',
            '[&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-walnut/55',
            '[&_a]:dark:text-accent-warm [&_a]:dark:decoration-accent-warm/55 [&_a]:transition-colors',
            '[&_a]:hover:text-walnut [&_a]:dark:hover:text-cream',
          ].join(' ')}
        >
          {children}
        </div>
      </article>
      <MarketingFooter />
    </main>
  )
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      pageTitle={'Privacy \u2014 Inkwell'}
      lastUpdated="Last updated: this is a beta placeholder."
    >
      <p>
        This is a placeholder privacy policy for Inkwell while the product is in beta. A full,
        legally reviewed version will replace this before paid plans launch.
      </p>

      <h2>What Inkwell stores</h2>
      <p>
        Inkwell saves your manuscripts, notes, and settings to your device first. If you sign in
        and enable cloud sync, an encrypted copy of your library can also be stored in your
        Inkwell account so it travels between devices and survives a lost browser profile.
      </p>

      <h2>Account information</h2>
      <p>
        If you create an account, we record an email address for sign-in and a password hash that
        Inkwell never sees in plain text. We may also keep basic billing metadata when paid plans
        launch (handled by our payment processor; full card details are not stored by Inkwell).
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not train AI models on your manuscripts.</li>
        <li>We do not show ads.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about privacy can go to{' '}
        <a href="mailto:support@enterthelimelight.com">support@enterthelimelight.com</a>
        {'. '}
        For other inquiries,{' '}
        <a href="mailto:contact@enterthelimelight.com">contact@enterthelimelight.com</a>.
      </p>
    </LegalPage>
  )
}

export function RefundPage() {
  return (
    <LegalPage
      title="Refund policy"
      pageTitle={'Refunds \u2014 Inkwell'}
      lastUpdated="Last updated: this is a beta placeholder."
    >
      <p>
        This is a placeholder refund policy for Inkwell while the product is in beta. A full,
        legally reviewed version will replace this before paid purchases launch.
      </p>

      <h2>Before you buy</h2>
      <p>
        Inkwell is digital software. Please review the feature list and beta status on the site
        before purchasing a paid tier.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href="mailto:support@enterthelimelight.com">support@enterthelimelight.com</a> from the address used for
        your purchase and include your receipt or transaction reference.
        Paid checkout may be processed by our reseller (Paddle); where Paddle handles payment
        support for your order, their process may apply in addition to this policy.
      </p>

      <h2>Statutory rights</h2>
      <p>
        Nothing here limits consumer rights that apply in your country or region where those rights
        cannot be waived by contract.
      </p>
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      pageTitle={'Terms \u2014 Inkwell'}
      lastUpdated="Last updated: this is a beta placeholder."
    >
      <p>
        This is a placeholder terms of use document for Inkwell during the beta. A full version
        will replace this before paid plans launch.
      </p>

      <h2>Beta status</h2>
      <p>
        Inkwell is in active beta. Features may change, and there may be occasional bugs. Please
        keep your own backups while we polish the edges.
      </p>

      <h2>Your work, your rights</h2>
      <p>
        You own the manuscripts, notes, and other content you create in Inkwell. Using the
        product does not grant Inkwell any ownership over your writing.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Please do not use Inkwell to host illegal content, attempt to break security, or abuse
        the cloud sync service. We reserve the right to suspend accounts that do.
      </p>

      <h2>Cloud storage</h2>
      <p>
        Paid tiers that include cloud library backup are subject to per-tier limits on the size of your compressed
        library backup (currently 2 GB on Basic and 20 GB on Pro). Local writing on your device is not capped by these
        limits. If you exceed your tier limit, cloud sync uploads may pause until you free space or upgrade; we may
        adjust limits or fair-use policies with notice as the product matures.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can go to{' '}
        <a href="mailto:support@enterthelimelight.com">support@enterthelimelight.com</a>
        {'. '}
        General contact:{' '}
        <a href="mailto:contact@enterthelimelight.com">contact@enterthelimelight.com</a>.
      </p>
    </LegalPage>
  )
}
