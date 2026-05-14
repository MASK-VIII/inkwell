import { MARKETING_SITE_URL } from '../marketingSeoConstants'

type Props = {
  slug: string
  title: string
  description: string
  dateModified: string
}

/**
 * Article + BreadcrumbList for guide pages (homepage graph stays in MarketingJsonLd).
 */
export function GuideJsonLd({ slug, title, description, dateModified }: Props) {
  const pageUrl = `${MARKETING_SITE_URL}/guides/${slug}`
  const guidesUrl = `${MARKETING_SITE_URL}/guides`

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${MARKETING_SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: guidesUrl },
          { '@type': 'ListItem', position: 3, name: title, item: pageUrl },
        ],
      },
      {
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: title,
        description,
        url: pageUrl,
        dateModified,
        inLanguage: 'en-US',
        author: { '@type': 'Organization', name: 'Inkwell', url: MARKETING_SITE_URL },
        publisher: { '@type': 'Organization', name: 'Inkwell', url: MARKETING_SITE_URL },
        isPartOf: { '@type': 'WebSite', name: 'Inkwell', url: `${MARKETING_SITE_URL}/` },
      },
    ],
  }

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  )
}
