import type { ReactNode } from 'react'
import { MarketingFooter } from '../MarketingFooter'
import { MarketingNav } from '../MarketingNav'

const proseArticleClass = [
  'prose prose-sm mt-8 max-w-none text-walnut/90 dark:text-ink-dark/90',
  '[&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ink [&_h2]:dark:text-ink-dark',
  '[&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:text-ink [&_h3]:dark:text-ink-dark',
  '[&_p]:mt-4 [&_p]:leading-relaxed',
  '[&_strong]:text-ink [&_strong]:dark:text-ink-dark',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1 [&_li]:marker:text-walnut/60 [&_li]:dark:marker:text-ink-dark/50',
  '[&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-walnut/55',
  '[&_a]:dark:text-accent-warm [&_a]:dark:decoration-accent-warm/55 [&_a]:transition-colors',
  '[&_a]:hover:text-walnut [&_a]:dark:hover:text-cream',
].join(' ')

type Crumb = { href: string; label: string }

type Props = {
  darkMode: boolean
  onToggleDarkMode: () => void
  title: string
  description: string
  crumbs: Crumb[]
  children: ReactNode
}

export function GuideLayout({ darkMode, onToggleDarkMode, title, description, crumbs, children }: Props) {
  return (
    <main className="min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav showAnchors={false} darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
      <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
        <nav aria-label="Breadcrumb" className="text-xs text-walnut/75 dark:text-ink-dark/65">
          <ol className="flex flex-wrap items-center gap-1.5">
            {crumbs.map((c, i) => (
              <li key={c.href} className="flex items-center gap-1.5">
                {i > 0 ?
                  <span aria-hidden className="text-walnut/50 dark:text-ink-dark/45">
                    /
                  </span>
                : null}
                {i < crumbs.length - 1 ?
                  <a
                    href={c.href}
                    className="rounded-sm font-medium text-ink underline decoration-walnut/35 underline-offset-2 transition hover:decoration-walnut/55 dark:text-ink-dark dark:decoration-cream/35 dark:hover:decoration-cream/55"
                  >
                    {c.label}
                  </a>
                : <span className="font-medium text-ink dark:text-ink-dark">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>

        <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
          Guide
        </p>
        <h1 className="mt-2 font-serif text-4xl leading-[1.1] text-ink sm:text-5xl dark:text-ink-dark">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-walnut/88 dark:text-ink-dark/82">{description}</p>

        <div className={proseArticleClass}>{children}</div>

        <aside className="mt-14 rounded-2xl border border-dust/70 bg-panel-light-muted/50 p-6 dark:border-border-dark dark:bg-panel-dark/60">
          <p className="font-serif text-lg text-ink dark:text-ink-dark">Try Inkwell on your manuscript</p>
          <p className="mt-2 text-sm leading-relaxed text-walnut/85 dark:text-ink-dark/78">
            Start writing free in the browser with no signup—every export format is included, and your
            work stays on your device.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/app#bookshelf"
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition hover:bg-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
            >
              Start writing free
            </a>
            <a
              href="/guides"
              className="inline-flex items-center justify-center rounded-full border border-walnut/30 px-5 py-2.5 text-sm font-medium text-ink transition hover:border-walnut/55 dark:border-border-dark dark:text-ink-dark dark:hover:border-accent-warm/45"
            >
              More guides
            </a>
          </div>
        </aside>
      </article>
      <MarketingFooter />
    </main>
  )
}
