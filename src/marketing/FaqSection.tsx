import type { ReactNode } from 'react'
import {
  CLOUD_LIMIT_BASIC_DISPLAY,
  CLOUD_LIMIT_PRO_DISPLAY,
  INKWELL_DISPLAY_PRICE_BASIC,
  INKWELL_DISPLAY_PRICE_PRO,
  INKWELL_DISPLAY_PRICE_PRO_LIST,
} from './pricingCopy'

type Qa = {
  q: string
  a: ReactNode
}

const FAQ: Qa[] = [
  {
    q: 'How mature is Inkwell right now?',
    a: (
      <>
        Inkwell 1.0 is built and supported by one person—the core writing loop (projects, chapters, notes, formatting
        previews, and exports) is stable in daily use. Edge cases still surface; fixes ship quickly and a public roadmap
        shows what is next. Paid tiers include a 30-day refund so you can judge honestly. For evergreen workflow notes,
        see{' '}
        <a
          href="/guides"
          className="font-medium text-ink underline decoration-walnut/45 underline-offset-2 transition hover:decoration-walnut/70 dark:text-cream dark:decoration-cream/45 dark:hover:decoration-cream/70"
        >
          Inkwell guides
        </a>
        .
      </>
    ),
  },
  {
    q: 'Is Inkwell only for beginners?',
    a:
      'No. Free gives everyone the same chapter-first workspace—ideal when you are starting out—while Basic and Pro add cloud backup and publishing exports for authors deep in revisions or shipping multiple books. Everything stays offline-capable on every tier.',
  },
  {
    q: 'What do I get for free?',
    a: 'The full writing experience: projects, chapters, notes, organization, and formatting previews. Your library stays on this device only—no cloud backup. You do not need an account to start; sign in later if you upgrade to Basic or Pro. You can use Inkwell indefinitely on the Free plan.',
  },
  {
    q: 'What is locked on Free?',
    a: `EPUB export and cloud library backup (Basic up to ${CLOUD_LIMIT_BASIC_DISPLAY} compressed backup, Pro up to ${CLOUD_LIMIT_PRO_DISPLAY}). Free is local-only storage; Basic unlocks cloud sync and EPUB, and Pro unlocks the full export suite.`,
  },
  {
    q: 'What does Basic unlock?',
    a: `Cloud library sync and backup across your devices when you sign in (up to ${CLOUD_LIMIT_BASIC_DISPLAY} compressed backup), plus EPUB export—the simplest finish line if you are publishing digitally. Like Pro, it is a one-time purchase and includes lifetime app updates.`,
  },
  {
    q: 'Do Basic and Pro get the same app updates?',
    a: 'Yes. Both paid tiers include lifetime updates—bug fixes, improvements, and new features ship to Basic and Pro the same way. Pro only changes which export and formatting capabilities are unlocked, not how often the app is updated.',
  },
  {
    q: 'Why are exports paid?',
    a: 'Because Inkwell is built by one developer. Paid exports keep the lights on and the updates coming.',
  },
  {
    q: 'What happens to Pro pricing after intro pricing ends?',
    a: `New Pro purchases list at ${INKWELL_DISPLAY_PRICE_PRO_LIST} once intro pricing ends. If you buy Pro at intro (${INKWELL_DISPLAY_PRICE_PRO}), you keep lifetime Pro at that tier—your purchase is grandfathered. Basic remains ${INKWELL_DISPLAY_PRICE_BASIC} for new buyers; if you already bought Basic, nothing changes for your license.`,
  },
  {
    q: 'What is your refund policy?',
    a:
      'Basic and Pro are one-time purchases with a 30-day refund window: email support from the address used at checkout, with your receipt or transaction reference, and we will issue a full refund within that window if Inkwell is not the right fit. Details and Paddle/reseller terms are on the Refund policy page in the site footer.',
  },
  {
    q: 'Where is my work stored?',
    a: `On Free, your library lives only on your device. With Basic or Pro, you can optionally sync a packaged library backup to private cloud storage tied to your account (TLS in transit), subject to per-tier limits (${CLOUD_LIMIT_BASIC_DISPLAY} Basic, ${CLOUD_LIMIT_PRO_DISPLAY} Pro, measured as compressed backup size).`,
  },
  {
    q: 'Do I need an internet connection?',
    a: 'No. Inkwell works fully offline. Cloud backup is optional on Basic and Pro; it runs in the background when you are online.',
  },
  {
    q: 'Can I use Inkwell for self-publishing on Kindle?',
    a:
      'Yes. Export your manuscript as EPUB on Basic (or stay on Free until you are ready to buy a tier). EPUB is the usual starting point for Kindle Direct Publishing and many other ebook stores—you finish and refine in Inkwell, then upload the file where you sell. Pro adds PDF and DOCX when you need print interiors or other workflows; Basic is enough if your next step is digital publishing with EPUB.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="bg-parchment dark:bg-panel-dark">
      <div className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">Common questions</p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            What writers usually want to know.
          </h2>
        </div>

        <ul className="divide-y divide-dust/70 border-y border-dust/70 dark:divide-border-dark dark:border-border-dark">
          {FAQ.map((qa) => (
            <li key={qa.q}>
              <details className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6">
                  <span className="font-serif text-lg text-ink dark:text-ink-dark">{qa.q}</span>
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-walnut/30 text-walnut transition group-open:rotate-45 dark:border-border-dark dark:text-ink-dark/82"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="6" y1="2" x2="6" y2="10" />
                      <line x1="2" y1="6" x2="10" y2="6" />
                    </svg>
                  </span>
                </summary>
                <div className="mt-3 max-w-3xl text-sm leading-relaxed text-walnut/90 dark:text-ink-dark/82">
                  {qa.a}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
