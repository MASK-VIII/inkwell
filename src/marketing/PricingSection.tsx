import {
  CLOUD_LIMIT_BASIC_DISPLAY,
  CLOUD_LIMIT_PRO_DISPLAY,
  INKWELL_DISPLAY_PRICE_BASIC,
  INKWELL_DISPLAY_PRICE_PRO,
  INKWELL_DISPLAY_PRICE_PRO_LIST,
  pricingCopy,
} from './pricingCopy'

type Plan = {
  name: string
  price: string
  compareAtPrice?: string
  badge?: string
  forWhom: string
  bullets: string[]
  cta: { label: string; href: string }
  finePrint?: string
}

/** Opens the sign-in screen with the chosen checkout intent attached; post-auth flow opens `UpgradeOfferModal`. */
const APP_UPGRADE_HREF = {
  basic: '/app?checkout=basic#signin',
  pro: '/app?checkout=pro#signin',
  upgrade: '/app?checkout=upgrade#signin',
} as const

const PLANS: Record<'basic' | 'pro', Plan> = {
  basic: {
    name: 'Basic',
    price: INKWELL_DISPLAY_PRICE_BASIC,
    badge: 'One-time',
    forWhom: 'Everything you need to get your first ebook on the market.',
    bullets: [
      'Full writing workspace—the same chapter-first app you can start free on',
      `Cloud library sync & backup across your devices (up to ${CLOUD_LIMIT_BASIC_DISPLAY} compressed backup)`,
      'EPUB export',
      '30-day refund if Inkwell is not the right fit',
      'Lifetime app updates—included with your one-time purchase',
      'Offline-first; unlimited local storage on each device',
    ],
    cta: { label: 'Unlock Basic', href: APP_UPGRADE_HREF.basic },
    finePrint: pricingCopy.basicFinePrint,
  },
  pro: {
    name: 'Pro',
    price: INKWELL_DISPLAY_PRICE_PRO,
    compareAtPrice: INKWELL_DISPLAY_PRICE_PRO_LIST,
    badge: 'Early access',
    forWhom: 'For authors who want every export format, advanced layout control, and a toolchain that keeps up with a serious publishing workflow.',
    bullets: [
      `Everything in Basic, including higher backup space (up to ${CLOUD_LIMIT_PRO_DISPLAY})`,
      'Full export suite (PDF / DOCX / Markdown / plain text)',
      'Advanced formatting + presets',
      '30-day refund if Inkwell is not the right fit',
      'Priority email support',
    ],
    cta: { label: 'Go Pro', href: APP_UPGRADE_HREF.pro },
    finePrint: pricingCopy.proFinePrint,
  },
}

function TrustRow() {
  const items = [
    { label: 'Free forever', detail: 'Local writing, no signup' },
    { label: 'No credit card', detail: 'Start instantly' },
    { label: 'One-time purchases', detail: 'Own your tools' },
    { label: '30-day refund', detail: 'Full refund on paid tiers—see policy' },
    { label: 'Unlimited local storage', detail: 'On your device' },
  ]

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-dust/70 bg-panel-light-muted/62 px-4 py-3 text-sm text-walnut/85 dark:border-border-dark dark:bg-panel-dark/50 dark:text-ink-dark/78"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">{it.label}</p>
          <p className="mt-1">{it.detail}</p>
        </div>
      ))}
    </div>
  )
}

function PlanCard({
  plan,
  featured = false,
  subtle = false,
}: {
  plan: Plan
  featured?: boolean
  subtle?: boolean
}) {
  return (
    <div
      className={[
        'relative flex h-full flex-col rounded-2xl border p-6 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] transition',
        subtle ?
          'border-dust/60 bg-panel-light-muted/52 hover:border-dust/90 hover:bg-panel-light-muted/68 dark:border-border-dark/70 dark:bg-panel-dark/45 dark:hover:bg-panel-dark/55'
        : 'border-dust/70 bg-parchment/70 hover:border-walnut/40 hover:bg-parchment dark:border-border-dark dark:bg-panel-dark/60 dark:hover:border-accent-warm/40 dark:hover:bg-panel-dark/75',
        featured ?
          'ring-2 ring-walnut/20 dark:ring-cream/20'
        : 'ring-1 ring-walnut/5 dark:ring-cream/10',
      ].join(' ')}
    >
      {featured && (
        <div className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-parchment shadow-sm dark:bg-accent-warm dark:text-panel-dark">
          Best value
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-2xl leading-tight text-ink dark:text-ink-dark">{plan.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-walnut/85 dark:text-ink-dark/78">{plan.forWhom}</p>
        </div>
        <div className="shrink-0 text-right sm:min-w-[7.5rem]">
          <div className="flex flex-wrap items-baseline justify-end gap-2">
            {plan.compareAtPrice && (
              <p
                className="font-serif text-lg leading-none text-walnut/60 line-through decoration-walnut/45 dark:text-ink-dark/55 dark:decoration-ink-dark/40"
                aria-label={`Previously ${plan.compareAtPrice}`}
              >
                {plan.compareAtPrice}
              </p>
            )}
            <p className="font-serif text-3xl leading-none tracking-tight text-ink tabular-nums dark:text-accent-warm sm:text-4xl">
              {plan.price}
            </p>
          </div>
          {plan.badge && (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-walnut/80 dark:text-cream/88">
              {plan.badge}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-5 space-y-2.5 text-sm leading-snug text-walnut/90 dark:text-ink-dark/82">
        {plan.bullets.map((b) => (
          <li key={b} className="flex gap-2.5">
            <span
              className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-walnut/50 dark:bg-accent-warm/70"
              aria-hidden
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {plan.finePrint ?
        <p className="mt-4 text-xs leading-relaxed text-walnut/75 dark:text-ink-dark/68">{plan.finePrint}</p>
      : null}

      <div className="min-h-4 flex-1" aria-hidden />

      <div className="mt-6">
        <a
          href={plan.cta.href}
          className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-parchment shadow-sm transition hover:bg-walnut focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut sm:w-auto dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
        >
          {plan.cta.label}
        </a>
      </div>
    </div>
  )
}

export function PricingSection() {
  return (
    <section id="pricing" className="bg-parchment dark:bg-panel-dark">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-22">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
            Pricing
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            Start free. Upgrade when you’re ready.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            The full writing workspace stays free and local-first—you can install or open the app and write with no sign-up. Add Basic when you want sync and EPUB ({CLOUD_LIMIT_BASIC_DISPLAY} cloud backup); step up to Pro when you need the full export suite (PDF, DOCX, Markdown, plain text), advanced formatting for print or submissions, and {CLOUD_LIMIT_PRO_DISPLAY} backup. Basic and Pro are one-time purchases and both include lifetime app updates as Inkwell grows. Pro is at early-access pricing today; when the listed price moves to {INKWELL_DISPLAY_PRICE_PRO_LIST}, purchases made during early access keep lifetime Pro at the price you paid. Basic stays {INKWELL_DISPLAY_PRICE_BASIC} for new buyers after early access. Paid tiers include a 30-day refund—see{' '}
            <a
              href="/refund"
              className="font-medium text-ink underline decoration-walnut/35 underline-offset-2 hover:decoration-walnut/55 dark:text-ink-dark dark:decoration-cream/35 dark:hover:decoration-cream/55"
            >
              refund policy
            </a>
            .
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <PlanCard plan={PLANS.basic} subtle />
          <PlanCard plan={PLANS.pro} featured />
        </div>

        <TrustRow />

        <p className="mt-6 text-center text-sm leading-relaxed text-walnut/80 dark:text-ink-dark/72">
          {pricingCopy.upgradePathLine}{' '}
          <a
            href={APP_UPGRADE_HREF.upgrade}
            className="font-medium text-ink underline decoration-walnut/35 underline-offset-2 hover:decoration-walnut/55 dark:text-ink-dark dark:decoration-cream/35 dark:hover:decoration-cream/55"
          >
            Basic → Pro checkout
          </a>
        </p>
      </div>
    </section>
  )
}
