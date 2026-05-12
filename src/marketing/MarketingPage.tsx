import { CtaSection } from './CtaSection'
import { FaqSection } from './FaqSection'
import { FeaturesSection } from './FeaturesSection'
import { HeroSection } from './HeroSection'
import { HowItWorksSection } from './HowItWorksSection'
import { MarketingFooter } from './MarketingFooter'
import { MarketingJsonLd } from './MarketingJsonLd'
import { MarketingNav } from './MarketingNav'
import { PhWorkflowStrip } from './PhWorkflowStrip'
import { HOME_META_DESCRIPTION, HOME_OG_DESCRIPTION, HOME_OG_IMAGE } from './marketingSeoConstants'
import { PricingSection } from './PricingSection'
import { ScreenshotsSection } from './ScreenshotsSection'
import { useMarketingDarkMode } from './useMarketingDarkMode'
import { useMarketingPageHead } from './useMarketingPageHead'

/**
 * Public marketing landing for inkwell.enterthelimelight.com.
 * Renders in place of the app at `/`.
 */
export function MarketingPage() {
  const { darkMode, toggle } = useMarketingDarkMode()

  useMarketingPageHead({
    title: 'Inkwell \u2014 Draft. Format. Publish.',
    canonicalPath: '/',
    metaDescription: HOME_META_DESCRIPTION,
    ogDescription: HOME_OG_DESCRIPTION,
    ogImage: HOME_OG_IMAGE,
  })

  return (
    <main className="marketing-landing min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingJsonLd />
      <MarketingNav darkMode={darkMode} onToggleDarkMode={toggle} />
      <HeroSection darkMode={darkMode} />
      <PhWorkflowStrip />
      <FeaturesSection />
      <HowItWorksSection />
      <ScreenshotsSection darkMode={darkMode} />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <MarketingFooter />
    </main>
  )
}

export default MarketingPage
