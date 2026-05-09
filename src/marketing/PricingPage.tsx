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
    ogTitle: 'Inkwell pricing — Basic, Pro, and free local writing',
    metaDescription:
      'Inkwell pricing: free offline novel writing; Basic adds cloud backup and EPUB; Pro adds PDF, DOCX, and the full export suite. One-time purchases, lifetime updates.',
    ogDescription:
      'Compare Inkwell Basic vs Pro: local-first free tier, cloud sync and EPUB on Basic, full print and ebook exports on Pro. Pick the tier that matches your publishing workflow.',
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
