import { BuyPage } from './BuyPage'
import { ChangelogPage } from './ChangelogPage'
import { GuideArticlePage } from './guides/GuideArticlePage'
import { GuidesIndexPage } from './guides/GuidesIndexPage'
import { parseMarketingPath } from './marketingRouting'
import { MarketingPage } from './MarketingPage'
import { NotFoundPage } from './NotFoundPage'
import { PricingPage } from './PricingPage'
import { PrivacyPage, RefundPage, TermsPage } from './LegalPage'

/**
 * Top-level routing for the marketing surface (everything that is not `/app/*`).
 * Reads the path once at mount; full reloads navigate between marketing pages and
 * the app, which is the intentional split.
 */
export function MarketingApp() {
  const parsed = parseMarketingPath(window.location.pathname)
  switch (parsed.view) {
    case 'landing':
      return <MarketingPage />
    case 'pricing':
      return <PricingPage />
    case 'buy':
      return <BuyPage />
    case 'privacy':
      return <PrivacyPage />
    case 'terms':
      return <TermsPage />
    case 'refund':
      return <RefundPage />
    case 'changelog':
      return <ChangelogPage />
    case 'guides_index':
      return <GuidesIndexPage />
    case 'guide':
      return <GuideArticlePage slug={parsed.guideSlug} />
    case 'not_found':
    default:
      return <NotFoundPage />
  }
}

export default MarketingApp
