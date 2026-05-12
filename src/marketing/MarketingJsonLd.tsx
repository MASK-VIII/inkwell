import { HOME_META_DESCRIPTION, MARKETING_SITE_URL } from './marketingSeoConstants'
import { INKWELL_DISPLAY_PRICE_BASIC, INKWELL_DISPLAY_PRICE_PRO } from './pricingCopy'

function stripUsdSymbol(price: string): string {
  return price.replace(/^\$/, '').trim()
}

/**
 * Homepage structured data (SoftwareApplication + WebSite + Organization).
 * Mount only on `/` marketing landing.
 */
export function MarketingJsonLd() {
  const basic = stripUsdSymbol(INKWELL_DISPLAY_PRICE_BASIC)
  const pro = stripUsdSymbol(INKWELL_DISPLAY_PRICE_PRO)

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${MARKETING_SITE_URL}/#website`,
        url: `${MARKETING_SITE_URL}/`,
        name: 'Inkwell',
        description: HOME_META_DESCRIPTION,
        publisher: { '@id': `${MARKETING_SITE_URL}/#organization` },
        inLanguage: 'en-US',
      },
      {
        '@type': 'Organization',
        '@id': `${MARKETING_SITE_URL}/#organization`,
        name: 'Inkwell',
        url: `${MARKETING_SITE_URL}/`,
        description: HOME_META_DESCRIPTION,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Inkwell',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web Browser, Windows, macOS',
        description: HOME_META_DESCRIPTION,
        url: `${MARKETING_SITE_URL}/`,
        offers: [
          {
            '@type': 'Offer',
            name: 'Inkwell Basic',
            price: basic,
            priceCurrency: 'USD',
            description: 'One-time purchase: cloud library sync and EPUB export.',
          },
          {
            '@type': 'Offer',
            name: 'Inkwell Pro',
            price: pro,
            priceCurrency: 'USD',
            description: 'One-time purchase (intro pricing): full export suite including PDF and DOCX.',
          },
        ],
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
