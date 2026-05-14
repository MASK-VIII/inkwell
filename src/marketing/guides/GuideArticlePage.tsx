import { Suspense } from 'react'
import { useMarketingDarkMode } from '../useMarketingDarkMode'
import { useMarketingPageHead } from '../useMarketingPageHead'
import { MarketingFooter } from '../MarketingFooter'
import { MarketingNav } from '../MarketingNav'
import { HOME_OG_IMAGE } from '../marketingSeoConstants'
import { getGuideBySlug } from './guideRegistry'
import { GuideJsonLd } from './GuideJsonLd'
import { GuideLayout } from './GuideLayout'

function GuideBodyFallback() {
  return (
    <p className="mt-8 text-sm text-walnut/75 dark:text-ink-dark/70" role="status">
      Loading guide…
    </p>
  )
}

type Props = {
  slug: string
}

export function GuideArticlePage({ slug }: Props) {
  const { darkMode, toggle } = useMarketingDarkMode()
  const guide = getGuideBySlug(slug)
  const canonicalPath = `/guides/${slug}`

  useMarketingPageHead(
    guide ?
      {
        title: `${guide.title} \u2014 Inkwell`,
        canonicalPath,
        metaDescription: guide.description,
        ogTitle: guide.title,
        ogDescription: guide.description,
        ogImage: HOME_OG_IMAGE,
      }
    : {
        title: 'Guide not found \u2014 Inkwell',
        canonicalPath,
        metaDescription: 'This Inkwell guide URL does not exist. Browse guides or return to the homepage.',
        ogDescription:
          'The guide you requested is not available. Explore other Inkwell guides or start writing free.',
        ogImage: HOME_OG_IMAGE,
        robots: 'noindex, nofollow',
      },
  )

  if (!guide) {
    return (
      <main className="flex min-h-screen flex-col bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
        <MarketingNav showAnchors={false} darkMode={darkMode} onToggleDarkMode={toggle} />
        <section className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-5 py-20 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-walnut/75 dark:text-ink-dark/60">
            Guides
          </p>
          <h1 className="mt-3 font-serif text-3xl text-ink dark:text-ink-dark">This guide is not here</h1>
          <p className="mt-4 text-base leading-relaxed text-walnut/88 dark:text-ink-dark/80">
            The slug may be mistyped or the page may have moved. Try the guides index or the homepage.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/guides"
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition hover:bg-walnut dark:bg-accent-warm dark:text-panel-dark dark:hover:bg-cream"
            >
              All guides
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-walnut/30 px-5 py-2.5 text-sm font-medium text-ink transition hover:border-walnut/55 dark:border-border-dark dark:text-ink-dark dark:hover:border-accent-warm/45"
            >
              Homepage
            </a>
          </div>
        </section>
        <MarketingFooter />
      </main>
    )
  }

  const { title, description, dateModified, Body } = guide

  const crumbs = [
    { href: '/', label: 'Home' },
    { href: '/guides', label: 'Guides' },
    { href: canonicalPath, label: title },
  ]

  return (
    <>
      <GuideJsonLd slug={slug} title={title} description={description} dateModified={dateModified} />
      <GuideLayout
        darkMode={darkMode}
        onToggleDarkMode={toggle}
        title={title}
        description={description}
        crumbs={crumbs}
      >
        <Suspense fallback={<GuideBodyFallback />}>
          <Body />
        </Suspense>
      </GuideLayout>
    </>
  )
}
