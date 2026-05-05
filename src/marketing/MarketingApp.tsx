import { classifyMarketingPath } from './marketingRouting'
import { MarketingPage } from './MarketingPage'
import { NotFoundPage } from './NotFoundPage'
import { PrivacyPage, TermsPage } from './LegalPage'
import { ChangelogPage } from './ChangelogPage'

/**
 * Top-level routing for the marketing surface (everything that is not `/app/*`).
 * Reads the path once at mount; full reloads navigate between marketing pages and
 * the app, which is the intentional split.
 */
export function MarketingApp() {
  const view = classifyMarketingPath(window.location.pathname)
  switch (view) {
    case 'landing':
      return <MarketingPage />
    case 'privacy':
      return <PrivacyPage />
    case 'terms':
      return <TermsPage />
    case 'changelog':
      return <ChangelogPage />
    case 'not_found':
    default:
      return <NotFoundPage />
  }
}

export default MarketingApp
