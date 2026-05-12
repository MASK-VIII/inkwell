import { type ReactNode } from 'react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import { CLOUD_LIMIT_BASIC_DISPLAY, CLOUD_LIMIT_PRO_DISPLAY } from './pricingCopy'
import { useMarketingDarkMode } from './useMarketingDarkMode'
import { useMarketingPageHead } from './useMarketingPageHead'

type Props = {
  title: string
  /** Plain document title used for the browser tab. */
  pageTitle: string
  /** Canonical path on the marketing host (e.g. `/privacy`). */
  canonicalPath: string
  metaDescription: string
  ogDescription: string
  lastUpdated: string
  children: ReactNode
}

export function LegalPage({
  title,
  pageTitle,
  canonicalPath,
  metaDescription,
  ogDescription,
  lastUpdated,
  children,
}: Props) {
  const { darkMode, toggle } = useMarketingDarkMode()

  useMarketingPageHead({
    title: pageTitle,
    canonicalPath,
    metaDescription,
    ogDescription,
  })

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
      canonicalPath="/privacy"
      metaDescription="Inkwell privacy policy: how we handle manuscripts, account data, cloud sync, and payments as Inkwell evolves. We do not sell your data or train AI on your writing."
      ogDescription="Read how Inkwell treats local manuscripts vs optional cloud backup, what auth and billing providers see, and what we do not do with your work."
      lastUpdated="Last updated: May 7, 2026"
    >
      <p>
        This policy describes how Inkwell handles information for Inkwell 1.0 and future updates. We may
        update it as features evolve; the date at the top reflects the latest revision.
      </p>

      <h2>What Inkwell stores</h2>
      <p>
        Inkwell saves your manuscripts, notes, and settings on your device first (for example in
        your browser or desktop app storage). If you sign in and turn on cloud sync, your library is
        packaged and uploaded over HTTPS to private cloud storage tied to your account, under paths
        scoped to your user id, so it can sync across devices and outlive a single browser profile.
        Transport uses TLS; files at rest are protected by our hosting provider’s storage practices.
        Inkwell does not provide end-to-end encryption where only you hold the keys unless we ship
        that feature explicitly.
      </p>

      <h2>Account information</h2>
      <p>
        If you create an account, we rely on our authentication provider to store sign-in identifiers
        (such as email) and credential material appropriately; Inkwell does not receive your
        password in plain text. For paid tiers, billing is handled by our payment processor; Inkwell
        does not store full card numbers.
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
      canonicalPath="/refund"
      metaDescription="Inkwell refund policy: 30-day full refund on qualifying Basic and Pro purchases. How to request a refund and how Paddle checkout fits in."
      ogDescription="Basic and Pro include a 30-day refund window for qualifying one-time purchases. Email support with your receipt; reseller (Paddle) steps may apply."
      lastUpdated="Last updated: May 7, 2026"
    >
      <p>
        This refund policy applies to qualifying Basic and Pro one-time purchases. It stays in effect
        unless we post an update here (the date above shows the latest revision).
      </p>

      <h2>Before you purchase</h2>
      <p>
        Inkwell is digital software. Please review the feature list and pricing on the site before
        completing a purchase so you know what Basic and Pro unlock.
      </p>

      <h2>30-day refund window</h2>
      <p>
        For qualifying one-time purchases of Basic or Pro, you may request a{' '}
        <strong>full refund within 30 days</strong> of the date of purchase. Refunds apply to the
        software license only; they do not cover third-party fees or charges outside Paddle’s
        control.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href="mailto:support@enterthelimelight.com">support@enterthelimelight.com</a> from the address used for
        your purchase and include your receipt or transaction reference. Please contact us within the
        30-day window above.
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
      canonicalPath="/terms"
      metaDescription="Inkwell terms of use: your rights to your manuscripts, acceptable use, cloud backup limits, and how the product may change as Inkwell evolves."
      ogDescription="Terms covering product updates, content ownership, acceptable use, and cloud backup limits on Basic and Pro as Inkwell grows."
      lastUpdated="Last updated: May 7, 2026"
    >
      <p>
        These terms apply to Inkwell 1.0 and future updates. We may update them as the product matures;
        the date at the top reflects the latest revision.
      </p>

      <h2>Product updates</h2>
      <p>
        Inkwell is maintained by a solo founder. Features may evolve, and occasional bugs are possible.
        Please keep your own backups and check the public roadmap for what is planned next.
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
        library backup (currently {CLOUD_LIMIT_BASIC_DISPLAY} on Basic and {CLOUD_LIMIT_PRO_DISPLAY} on Pro). Local
        writing on your device is not capped by these limits. If you exceed your tier limit, cloud sync uploads may
        pause until you free space or upgrade; we may adjust limits or fair-use policies with notice as the product
        matures.
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
