import { HOME_META_DESCRIPTION, MARKETING_SITE_URL } from './marketingSeoConstants'

/**
 * Homepage structured data (SoftwareApplication + WebSite + Organization).
 * Mount only on `/` marketing landing.
 */
export function MarketingJsonLd() {
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
            name: 'Inkwell',
            price: '0',
            priceCurrency: 'USD',
            description: 'Free: full writing workspace and every export format (EPUB, PDF, DOCX, Markdown).',
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
