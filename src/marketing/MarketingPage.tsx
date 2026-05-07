import { useEffect } from 'react'
import { CtaSection } from './CtaSection'
import { FaqSection } from './FaqSection'
import { FeaturesSection } from './FeaturesSection'
import { HeroSection } from './HeroSection'
import { HowItWorksSection } from './HowItWorksSection'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import { PricingSection } from './PricingSection'
import { ScreenshotsSection } from './ScreenshotsSection'
import { useMarketingDarkMode } from './useMarketingDarkMode'

/**
 * Public marketing landing for inkwell.enterthelimelight.com.
 * Light-mode only by design. Renders in place of the app at `/`.
 */
export function MarketingPage() {
  const { darkMode, toggle } = useMarketingDarkMode()

  useEffect(() => {
    document.title = 'Inkwell \u2014 A workspace built for the long form'
    return () => {
      document.title = 'Inkwell'
    }
  }, [])

  return (
    <main className="marketing-landing min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav darkMode={darkMode} onToggleDarkMode={toggle} />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ScreenshotsSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <MarketingFooter />
    </main>
  )
}

export default MarketingPage
