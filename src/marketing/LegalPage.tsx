import { type ReactNode } from 'react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
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
      metaDescription="Inkwell privacy policy: free local-first writing software. Your manuscripts stay on your device; we do not sell your data or train AI on your writing."
      ogDescription="How Inkwell handles local manuscripts, optional desktop backups, and what we do not do with your work."
      lastUpdated="Last updated: July 17, 2026"
    >
      <p>
        This policy describes how Inkwell handles information for the current free, local-first product. We may update
        it as features evolve; the date at the top reflects the latest revision.
      </p>

      <h2>What Inkwell stores</h2>
      <p>
        Inkwell is local-first. Your manuscripts, notes, and settings are saved on your device (in your browser or the
        desktop app). Export and import tools let you back up or move your library with standard archive files
        (<code>.inkwell.zip</code>). Inkwell does not require an account and does not upload your writing to our
        servers as part of normal use.
      </p>

      <h2>Website and downloads</h2>
      <p>
        Visiting the marketing site or downloading the desktop installer may involve ordinary web hosting and analytics
        operated by our hosting providers. That traffic is separate from your manuscript library, which stays on your
        device.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not train AI models on your manuscripts.</li>
        <li>We do not show ads.</li>
        <li>We do not require a signup or cloud account to write or export.</li>
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
      title="Refunds"
      pageTitle={'Refunds \u2014 Inkwell'}
      canonicalPath="/refund"
      metaDescription="Inkwell is free local-first writing software. There are no paid purchases or subscriptions to refund."
      ogDescription="Inkwell is free to use. There are no in-app purchases or subscriptions to refund."
      lastUpdated="Last updated: July 17, 2026"
    >
      <p>
        Inkwell is <strong>free</strong> local-first writing software. There are no paid tiers, subscriptions, or
        in-app purchases.
      </p>

      <h2>Nothing to refund</h2>
      <p>
        Because Inkwell does not charge for software access, there is nothing to refund for current use. Open the app
        and write—every export format is included.
      </p>

      <h2>Older paid purchases</h2>
      <p>
        If you previously purchased a paid tier under an older version of Inkwell, email{' '}
        <a href="mailto:support@enterthelimelight.com">support@enterthelimelight.com</a> with your receipt and we will
        help on a case-by-case basis.
      </p>

      <h2>Statutory rights</h2>
      <p>
        Nothing here limits consumer rights that apply in your country or region where those rights cannot be waived by
        contract.
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
      metaDescription="Inkwell terms of use: your rights to your manuscripts, acceptable use, and how the free local-first product may change."
      ogDescription="Terms covering product updates, content ownership, and acceptable use for Inkwell free local-first writing software."
      lastUpdated="Last updated: July 17, 2026"
    >
      <p>
        These terms apply to the current free, local-first Inkwell product. We may update them as the product matures;
        the date at the top reflects the latest revision.
      </p>

      <h2>The product</h2>
      <p>
        Inkwell is free writing software you run in the browser or as a desktop app. Your library stays on your device.
        There is no account requirement and no paid unlock for exports or formatting features.
      </p>

      <h2>Product updates</h2>
      <p>
        Inkwell is maintained by a solo founder. Features may evolve, and occasional bugs are possible. Please keep
        your own backups (export archives) and check the public roadmap for what is planned next.
      </p>

      <h2>Your work, your rights</h2>
      <p>
        You own the manuscripts, notes, and other content you create in Inkwell. Using the product does not grant
        Inkwell any ownership over your writing.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Please do not use Inkwell to create or store illegal content, or attempt to break the security of the software
        or related websites. Abuse of our contact channels or download hosting may result in blocked access to those
        services.
      </p>

      <h2>Local storage and backups</h2>
      <p>
        Your library size is limited only by your device storage. Clearing browser data can delete a web library.
        Export <code>.inkwell.zip</code> archives regularly if you rely on Inkwell for important work.
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
