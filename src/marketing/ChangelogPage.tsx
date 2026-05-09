import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import { useMarketingDarkMode } from './useMarketingDarkMode'
import { useMarketingPageHead } from './useMarketingPageHead'
import { ChangelogSection } from './ChangelogSection'

export function ChangelogPage() {
  const { darkMode, toggle } = useMarketingDarkMode()

  useMarketingPageHead({
    title: 'Roadmap \u2014 Inkwell',
    canonicalPath: '/changelog',
    ogTitle: 'Inkwell roadmap — what we are shipping next',
    metaDescription:
      'Inkwell product roadmap and changelog: recent releases and what is next for novel writing, exports, and publishing workflow.',
    ogDescription:
      'See what shipped recently in Inkwell and what is on deck—updates to writing, formatting, exports, and the publishing toolchain.',
  })

  return (
    <main className="min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav showAnchors={false} darkMode={darkMode} onToggleDarkMode={toggle} />
      <ChangelogSection />
      <MarketingFooter />
    </main>
  )
}

export default ChangelogPage

