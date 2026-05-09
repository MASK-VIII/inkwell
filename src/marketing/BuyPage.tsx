import { Globe, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import {
  CLOUD_LIMIT_BASIC_DISPLAY,
  CLOUD_LIMIT_PRO_DISPLAY,
  INKWELL_DISPLAY_PRICE_BASIC,
  INKWELL_DISPLAY_PRICE_PRO,
  INKWELL_DISPLAY_PRICE_PRO_LIST,
  pricingCopy,
} from './pricingCopy'
import { useMarketingDarkMode } from './useMarketingDarkMode'
import { useMarketingPageHead } from './useMarketingPageHead'

/**
 * Optional one-line testimonial under the tiles. Set to null to hide; swap in a real quote
 * (with attribution) when one is ready — single edit, no other refactor needed.
 */
const TESTIMONIAL: { quote: string; attribution: string } | null = null

type BuyTile = {
  id: 'basic' | 'pro'
  name: string
  price: string
  compareAtPrice?: string
  badge?: string
  /** Shown under the price (e.g. One-time, Early access); separate from the featured corner pill. */
  priceNote?: string
  forWhom: string
  bullets: string[]
  cta: { label: string; href: string }
  finePrint?: string
  featured?: boolean
}

/** Anchors to `/app#signin` so SignInScreen can default to Create account when there is no remembered email. */
const BUY_HREF = {
  basic: '/app?checkout=basic#signin',
  pro: '/app?checkout=pro#signin',
  upgrade: '/app?checkout=upgrade#signin',
} as const

const TILES: BuyTile[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: INKWELL_DISPLAY_PRICE_BASIC,
    badge: 'One-time',
    forWhom:
      'Everything you need to get your first ebook on the market.',
    bullets: [
      `Cloud library sync & backup across your devices (up to ${CLOUD_LIMIT_BASIC_DISPLAY} compressed backup)`,
      'EPUB export',
      '30-day refund if Inkwell is not the right fit',
      'Lifetime app updates—included with your one-time purchase',
      'Full chapter-first writing workspace',
      'Offline-first; unlimited local storage on each device',
    ],
    cta: { label: `Get Basic (${INKWELL_DISPLAY_PRICE_BASIC})`, href: BUY_HREF.basic },
    finePrint: pricingCopy.basicFinePrint,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: INKWELL_DISPLAY_PRICE_PRO,
    compareAtPrice: INKWELL_DISPLAY_PRICE_PRO_LIST,
    badge: 'Best value',
    priceNote: 'Early access',
    forWhom:
      'For authors who want every export format, advanced layout control, and a toolchain that keeps up with a serious publishing workflow.',
    bullets: [
      `Everything in Basic, including higher backup space (up to ${CLOUD_LIMIT_PRO_DISPLAY})`,
      'Full export suite (PDF / DOCX / Markdown / plain text)',
      'Advanced formatting + presets',
      '30-day refund if Inkwell is not the right fit',
      'Priority email support',
    ],
    cta: { label: `Get Pro (${INKWELL_DISPLAY_PRICE_PRO})`, href: BUY_HREF.pro },
    finePrint: pricingCopy.proFinePrint,
    featured: true,
  },
]

function BuyTileCard({ tile }: { tile: BuyTile }) {
  return (
    <div
      className={[
        'relative flex h-full flex-col rounded-2xl border p-7 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] transition',
        tile.featured ?
          'border-walnut/35 bg-parchment/80 ring-2 ring-walnut/20 hover:border-walnut/55 dark:border-accent-warm/45 dark:bg-panel-dark/70 dark:ring-cream/20 dark:hover:border-accent-warm/65'
        : 'border-dust/70 bg-parchment/60 hover:border-walnut/40 hover:bg-parchment dark:border-border-dark dark:bg-panel-dark/55 dark:hover:border-accent-warm/40 dark:hover:bg-panel-dark/75',
      ].join(' ')}
    >
      {tile.featured ?
        <div className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-[0.7rem] font-medium uppercase tracking-widest text-parchment shadow-sm dark:bg-accent-warm dark:text-panel-dark">
          {tile.badge ?? 'Best value'}
        </div>
      : null}

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl leading-tight text-ink dark:text-ink-dark">{tile.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-walnut/85 dark:text-ink-dark/78">{tile.forWhom}</p>
        </div>
        <div className="shrink-0 text-right sm:min-w-[7.5rem]">
          <div className="flex flex-wrap items-baseline justify-end gap-2">
            {tile.compareAtPrice ?
              <p
                className="font-serif text-lg leading-none text-walnut/60 line-through decoration-walnut/45 dark:text-ink-dark/55 dark:decoration-ink-dark/40"
                aria-label={`Previously ${tile.compareAtPrice}`}
              >
                {tile.compareAtPrice}
              </p>
            : null}
            <p className="font-serif text-3xl leading-none tracking-tight text-ink tabular-nums dark:text-accent-warm sm:text-4xl">
              {tile.price}
              <span className="ml-1 align-top text-xs font-semibold uppercase tracking-[0.14em] text-walnut/75 dark:text-cream/80">
                USD
              </span>
            </p>
          </div>
          {tile.badge && !tile.featured ?
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-walnut/80 dark:text-cream/88">
              {tile.badge}
            </p>
          : null}
          {tile.priceNote ?
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-walnut/80 dark:text-cream/88">
              {tile.priceNote}
            </p>
          : null}
        </div>
      </div>

      <ul className="mt-6 space-y-2.5 text-sm leading-snug text-walnut/90 dark:text-ink-dark/82">
        {tile.bullets.map((b) => (
          <li key={b} className="flex gap-2.5">
            <span
              aria-hidden
              className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-walnut/50 dark:bg-accent-warm/70"
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {tile.finePrint ?
        <p className="mt-5 text-xs leading-relaxed text-walnut/75 dark:text-ink-dark/68">{tile.finePrint}</p>
      : null}

      <div className="min-h-4 flex-1" aria-hidden />

      <div className="mt-auto pt-7">
        <a
          href={tile.cta.href}
          className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-parchment shadow-sm transition hover:bg-walnut focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
        >
          {tile.cta.label}
        </a>
      </div>
    </div>
  )
}

type ReassuranceItem = {
  icon: typeof Lock
  title: string
  body: string
  href?: string
}

const REASSURANCE_ITEMS: ReassuranceItem[] = [
  {
    icon: Lock,
    title: 'Secure checkout by Paddle',
    body: 'Card and PayPal handled by Paddle. We never see your payment details.',
  },
  {
    icon: ShieldCheck,
    title: '30-day refund',
    body: 'Not the right fit? Email us within 30 days of purchase for a full refund.',
    href: '/refund',
  },
  {
    icon: Globe,
    title: 'All prices in USD',
    body: `One-time purchases on Basic and Pro both include lifetime app updates. Cloud backup is capped per tier (${CLOUD_LIMIT_BASIC_DISPLAY} Basic, ${CLOUD_LIMIT_PRO_DISPLAY} Pro).`,
  },
  {
    icon: Sparkles,
    title: 'Your work stays yours',
    body: 'Inkwell is offline-first. Cancel anytime; your local manuscripts are unaffected.',
  },
]

function ReassuranceRail() {
  return (
    <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {REASSURANCE_ITEMS.map((item) => {
        const Icon = item.icon
        const Inner = (
          <div className="flex h-full items-start gap-3 rounded-2xl border border-dust/70 bg-parchment/55 px-4 py-4 transition group-hover:border-walnut/40 group-hover:bg-parchment dark:border-border-dark dark:bg-panel-dark/55 dark:group-hover:border-accent-warm/45 dark:group-hover:bg-panel-dark/75">
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-walnut/10 text-walnut dark:bg-accent-warm/15 dark:text-accent-warm"
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink dark:text-ink-dark">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-walnut/80 dark:text-ink-dark/70">
                {item.body}
              </p>
            </div>
          </div>
        )
        return (
          <li key={item.title}>
            {item.href ?
              <a
                href={item.href}
                className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-walnut/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment dark:focus-visible:ring-cream/45 dark:focus-visible:ring-offset-panel-dark"
              >
                {Inner}
              </a>
            : <div className="group h-full">{Inner}</div>}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Standalone `/buy` page. Lightweight conversion surface: pick a plan, follow the CTA into
 * `/app?checkout=<plan>#signin` where SignInScreen handles auth (Create account by default for
 * first-time buyers) and post-auth opens `UpgradeOfferModal` for the chosen plan.
 */
export function BuyPage() {
  const { darkMode, toggle } = useMarketingDarkMode()

  useMarketingPageHead({
    title: 'Buy Inkwell \u2014 Basic or Pro',
    canonicalPath: '/buy',
    ogTitle: 'Buy Inkwell — Basic or Pro (one-time)',
    metaDescription:
      `Purchase Inkwell Basic or Pro: secure Paddle checkout, lifetime app updates, EPUB on Basic and PDF/DOCX on Pro. Cloud backup up to ${CLOUD_LIMIT_BASIC_DISPLAY} (Basic) or ${CLOUD_LIMIT_PRO_DISPLAY} (Pro).`,
    ogDescription:
      `Buy Inkwell: Basic includes cloud sync (${CLOUD_LIMIT_BASIC_DISPLAY} backup) and EPUB; Pro adds the full export suite and ${CLOUD_LIMIT_PRO_DISPLAY} backup. One-time license, 30-day refund window.`,
  })

  return (
    <main className="marketing-landing min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav darkMode={darkMode} onToggleDarkMode={toggle} showAnchors={false} />

      <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
            Buy Inkwell
          </p>
          <h1 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl dark:text-ink-dark">
            Pick a plan. Sign in next, then checkout.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-walnut/85 dark:text-ink-dark/80">
            Both plans are one-time purchases that attach to your Inkwell account so the unlock
            travels with you. You can keep using the free local-only tier forever; the writing
            workspace is the same on every plan.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {TILES.map((tile) => (
            <BuyTileCard key={tile.id} tile={tile} />
          ))}
        </div>

        <ReassuranceRail />

        {TESTIMONIAL ?
          <figure className="mx-auto mt-10 max-w-2xl rounded-2xl border border-dust/70 bg-parchment/55 px-6 py-5 text-center dark:border-border-dark dark:bg-panel-dark/55">
            <blockquote className="font-serif text-base italic leading-relaxed text-ink dark:text-ink-dark">
              &ldquo;{TESTIMONIAL.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-3 text-xs uppercase tracking-[0.18em] text-walnut/70 dark:text-ink-dark/60">
              {TESTIMONIAL.attribution}
            </figcaption>
          </figure>
        : null}

        <p className="mt-8 text-center text-sm leading-relaxed text-walnut/80 dark:text-ink-dark/72">
          {pricingCopy.upgradePathLine}{' '}
          <a
            href={BUY_HREF.upgrade}
            className="font-medium text-ink underline decoration-walnut/35 underline-offset-2 hover:decoration-walnut/55 dark:text-ink-dark dark:decoration-cream/35 dark:hover:decoration-cream/55"
          >
            Basic {'\u2192'} Pro checkout
          </a>
        </p>

        <p className="mt-10 text-center text-xs text-walnut/65 dark:text-ink-dark/55">
          Already signed in? Your purchase will attach to the account you are signed into. Secure
          checkout is processed by Paddle.
        </p>
      </section>

      <MarketingFooter />
    </main>
  )
}

export default BuyPage
