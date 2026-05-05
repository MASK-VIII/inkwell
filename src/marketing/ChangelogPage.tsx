import { useEffect } from 'react'
import { MarketingFooter } from './MarketingFooter'
import { MarketingNav } from './MarketingNav'
import { useMarketingDarkMode } from './useMarketingDarkMode'
import { ChangelogSection } from './ChangelogSection'

export function ChangelogPage() {
  const { darkMode, toggle } = useMarketingDarkMode()

  useEffect(() => {
    document.title = 'Changelog \u2014 Inkwell'
    return () => {
      document.title = 'Inkwell'
    }
  }, [])

  return (
    <main className="min-h-screen bg-parchment text-ink antialiased dark:bg-panel-dark dark:text-ink-dark">
      <MarketingNav showAnchors={false} darkMode={darkMode} onToggleDarkMode={toggle} />
      <ChangelogSection />
      <MarketingFooter />
    </main>
  )
}

export default ChangelogPage

