import {
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

/** Opens `/app` Account flow and triggers Paddle checkout when `VITE_PADDLE_CHECKOUT_*` is set. */
const APP_UPGRADE_HREF = {
  basic: '/app?checkout=basic#account',
  pro: '/app?checkout=pro#account',
  upgrade: '/app?checkout=upgrade#account',
} as const

const PLANS: Record<'basic' | 'pro', Plan> = {
  basic: {
    name: 'Basic',
    price: INKWELL_DISPLAY_PRICE_BASIC,
    badge: 'One-time',
    forWhom: 'For writers who want a cloud-backed library and an ebook finish line.',
    bullets: [
      'Full writing workspace—the same chapter-first app you can start free on',
      'Cloud library sync & backup across your devices',
      'EPUB export',
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
    forWhom: 'For serious indie authors finishing a book.',
    bullets: [
      'Everything in Basic',
      'Full export suite (PDF / DOCX / Markdown / plain text)',
      'Advanced formatting + presets',
      'Lifetime updates',
      'Priority email support',
    ],
    cta: { label: 'Go Pro', href: APP_UPGRADE_HREF.pro },
    finePrint: pricingCopy.proFinePrint,
  },
}

function TrustRow() {
  const items = [
    { label: 'Free forever', detail: 'Write without a timer' },
    { label: 'No credit card', detail: 'Start instantly' },
    { label: 'One-time purchases', detail: 'Own your tools' },
    { label: 'Unlimited local storage', detail: 'On your device' },
  ]

  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-dust/70 bg-white/40 px-4 py-3 text-sm text-walnut/85 dark:border-border-dark dark:bg-panel-dark/50 dark:text-ink-dark/78"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">{it.label}</p>
          <p className="mt-1">{it.detail}</p>
        </div>
      ))}
    </div>
  )
}

function FreeTierStrip() {
  return (
    <div className="mt-10 rounded-2xl border border-dust/70 bg-white/50 p-6 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] dark:border-border-dark dark:bg-panel-dark/55 sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-serif text-2xl text-ink dark:text-ink-dark">Free</h3>
            <p className="font-serif text-xl text-walnut/80 dark:text-ink-dark/65">$0</p>
            <span className="rounded-full border border-walnut/25 bg-parchment/80 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-widest text-walnut/75 dark:border-border-dark dark:bg-panel-dark dark:text-ink-dark/60">
              Local only
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-walnut/90 dark:text-ink-dark/85">
            Start with the full writing experience—projects, chapters, notes, organization, and formatting previews. Your
            library stays on this device until you choose Basic or Pro; no credit card required.
          </p>
        </div>
        <div className="shrink-0 lg:pl-2">
          <a
            href="/app"
            className="inline-flex w-full items-center justify-center rounded-full border border-walnut/35 bg-white/80 px-6 py-3 text-sm font-medium text-ink shadow-sm transition hover:border-walnut/55 hover:bg-white dark:border-border-dark dark:bg-panel-dark/80 dark:text-ink-dark dark:hover:border-accent-warm/45 dark:hover:bg-panel-dark sm:w-auto"
          >
            Start writing free
          </a>
        </div>
      </div>
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
        'relative rounded-2xl border p-7 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] transition',
        subtle ?
          'border-dust/60 bg-white/35 hover:border-dust/90 hover:bg-white/45 dark:border-border-dark/70 dark:bg-panel-dark/45 dark:hover:bg-panel-dark/55'
        : 'border-dust/70 bg-parchment/70 hover:border-walnut/40 hover:bg-parchment dark:border-border-dark dark:bg-panel-dark/60 dark:hover:border-accent-warm/40 dark:hover:bg-panel-dark/75',
        featured ?
          'ring-2 ring-walnut/20 dark:ring-cream/20'
        : 'ring-1 ring-walnut/5 dark:ring-cream/10',
      ].join(' ')}
    >
      {featured && (
        <div className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-[0.7rem] font-medium uppercase tracking-widest text-parchment shadow-sm dark:bg-accent-warm dark:text-panel-dark">
          Best value
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-2xl leading-tight text-ink dark:text-ink-dark">{plan.name}</h3>
          <p className="mt-2 text-sm text-walnut/85 dark:text-ink-dark/78">{plan.forWhom}</p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-2">
            {plan.compareAtPrice && (
              <p className="font-serif text-base text-walnut/55 line-through decoration-walnut/40 dark:text-ink-dark/50 dark:decoration-ink-dark/35">
                {plan.compareAtPrice}
              </p>
            )}
            <p className="font-serif text-2xl text-ink dark:text-ink-dark">{plan.price}</p>
          </div>
          {plan.badge && (
            <p className="mt-1 text-[0.7rem] font-medium uppercase tracking-widest text-walnut/70 dark:text-ink-dark/60">
              {plan.badge}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-6 space-y-2 text-sm text-walnut/90 dark:text-ink-dark/82">
        {plan.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-walnut/45 dark:bg-cream/35" aria-hidden />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {plan.finePrint && <p className="mt-5 text-xs text-walnut/70 dark:text-ink-dark/60">{plan.finePrint}</p>}

      <div className="mt-7">
        <a
          href={plan.cta.href}
          className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-medium text-parchment shadow-sm transition hover:bg-walnut focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
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
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
            Pricing
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            Start free. Upgrade when you are ready to publish.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            The workspace is free and local-first. Basic adds cloud backup and EPUB; Pro unlocks every export format—pick
            the finish line that fits.
          </p>
        </div>

        <TrustRow />

        <FreeTierStrip />

        <p className="mt-10 text-center text-xs font-medium uppercase tracking-[0.18em] text-walnut/70 dark:text-ink-dark/65">
          Paid upgrades
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <PlanCard plan={PLANS.basic} subtle />
          <PlanCard plan={PLANS.pro} featured />
        </div>
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
