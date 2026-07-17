import { useMarketingDarkMode } from '../useMarketingDarkMode'
import { useMarketingPageHead } from '../useMarketingPageHead'
import { MarketingFooter } from '../MarketingFooter'
import { MarketingNav } from '../MarketingNav'
import { GUIDES } from './guideRegistry'
import { HOME_OG_IMAGE } from '../marketingSeoConstants'

export function GuidesIndexPage() {
  const { darkMode, toggle } = useMarketingDarkMode()

  useMarketingPageHead({
    title: 'Guides \u2014 Inkwell',
    canonicalPath: '/guides',
    metaDescription:
      'Evergreen guides for novel drafting, EPUB and DOCX exports, print PDF basics, and local-first writing workflows.',
    ogTitle: 'Inkwell guides for authors',
    ogDescription:
      'Practical writing and publishing guides: exports, backups, and calmer workflows—without hype.',
    ogImage: HOME_OG_IMAGE,
  })

  return (
    <main className="min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav showAnchors={false} darkMode={darkMode} onToggleDarkMode={toggle} />
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">Guides</p>
        <h1 className="mt-2 font-serif text-4xl leading-[1.1] text-ink sm:text-5xl dark:text-ink-dark">
          Practical notes for long manuscripts
        </h1>
        <p className="mt-4 text-base leading-relaxed text-walnut/88 dark:text-ink-dark/82">
          Short, specific articles on exports, backups, and calm workflows—written for indie authors shipping digital
          or print. Everything they describe is free in Inkwell.
        </p>

        <ul className="mt-10 space-y-4">
          {GUIDES.map((g) => (
            <li
              key={g.slug}
              className="rounded-2xl border border-dust/70 bg-panel-light-muted/40 p-5 dark:border-border-dark dark:bg-panel-dark/50"
            >
              <a
                href={`/guides/${g.slug}`}
                className="font-serif text-xl text-ink underline decoration-walnut/35 underline-offset-2 transition hover:decoration-walnut/60 dark:text-ink-dark dark:decoration-cream/35 dark:hover:decoration-cream/60"
              >
                {g.title}
              </a>
              <p className="mt-2 text-sm leading-relaxed text-walnut/85 dark:text-ink-dark/78">{g.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <MarketingFooter />
    </main>
  )
}
