import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/dm-serif-display/400-italic.css'
import './index.css'
import { applyInkwellMotionDataset, readInitialPlayAnimations } from './lib/motionPreference'
import {
  isDesktopShell,
  pathIsApp,
  redirectInkwellMarketingToLandingRoot,
  redirectLegacyUserToApp,
  redirectWwwInkwellToApex,
  shouldRedirectInkwellMarketingUnknownPathToLanding,
  shouldRedirectLegacyUserToApp,
  shouldRedirectWwwInkwellToApex,
} from './marketing/marketingRouting'

applyInkwellMotionDataset(readInitialPlayAnimations())

const rootEl = document.getElementById('root')!
const root = createRoot(rootEl)

/**
 * Marketing landing lives at `/` on inkwell.enterthelimelight.com; the app lives at `/app`.
 * Returning users with bookmarks under `/` (e.g. `/#bookshelf`) are redirected to `/app`
 * so their flow keeps working. Electron desktop builds skip the marketing surface.
 */
function bootstrap() {
  if (typeof window === 'undefined') return

  if (shouldRedirectWwwInkwellToApex()) {
    redirectWwwInkwellToApex()
    return
  }

  if (shouldRedirectInkwellMarketingUnknownPathToLanding()) {
    redirectInkwellMarketingToLandingRoot()
    return
  }

  if (shouldRedirectLegacyUserToApp()) {
    redirectLegacyUserToApp()
    return
  }

  const useApp = pathIsApp(window.location.pathname) || isDesktopShell()

  if (useApp) {
    void Promise.all([import('./App'), import('./EditorErrorBoundary')]).then(
      ([{ default: App }, { EditorErrorBoundary }]) => {
        root.render(
          <StrictMode>
            <EditorErrorBoundary>
              <App />
            </EditorErrorBoundary>
          </StrictMode>,
        )
      },
    )
    return
  }

  void import('./marketing/MarketingApp').then(({ default: MarketingApp }) => {
    root.render(
      <StrictMode>
        <MarketingApp />
      </StrictMode>,
    )
  })
}

bootstrap()
