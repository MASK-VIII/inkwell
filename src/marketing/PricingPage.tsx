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
    title: 'Pricing \u2014 Inkwell (free)',
    canonicalPath: '/pricing',
    ogTitle: 'Inkwell pricing — free, all features included',
    metaDescription:
      'Inkwell is free: offline-first novel writing with formatting previews and the full export suite (EPUB, PDF, DOCX, Markdown). No account, no subscription.',
    ogDescription:
      'Inkwell is free to use—local-first writing, formatting previews, and every export format included. No tiers, no signup, no subscription.',
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
