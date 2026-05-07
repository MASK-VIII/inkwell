import { CtaSection } from './CtaSection'
import { FaqSection } from './FaqSection'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import { PricingSection } from './PricingSection'
import { useMarketingDarkMode } from './useMarketingDarkMode'
import { useMarketingPageHead } from './useMarketingPageHead'

/**
 * Standalone `/pricing` page. Wraps the existing landing-page `PricingSection` with marketing chrome
 * so the same plan tiles can be linked, shared, and indexed at a stable URL.
 */
export function PricingPage() {
  const { darkMode, toggle } = useMarketingDarkMode()

  useMarketingPageHead({
    title: 'Pricing \u2014 Inkwell',
    canonicalPath: '/pricing',
    ogDescription:
      'Inkwell pricing: start free and local-first, then add Basic for cloud sync and EPUB or Pro for the full export suite.',
  })

  return (
    <main className="marketing-landing min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav darkMode={darkMode} onToggleDarkMode={toggle} showAnchors={false} />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <MarketingFooter />
    </main>
  )
}

export default PricingPage
