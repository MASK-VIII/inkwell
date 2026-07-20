const STUDIO = {
  '@type': 'Organization' as const,
  name: 'Enter the Limelight',
  url: 'https://enterthelimelight.com',
  logo: 'https://enterthelimelight.com/favicon.svg',
  founder: {
    '@type': 'Person',
    name: 'Steven Spacek Jr.',
  },
  sameAs: [] as string[],
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    ...STUDIO,
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Enter the Limelight',
    url: 'https://enterthelimelight.com',
    description:
      'Independent studio behind Inkwell, free local-first novel writing software, and Landmark, a swipe-to-discover app for cool things nearby.',
    publisher: STUDIO,
  }
}

export function inkwellSoftwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Inkwell',
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: 'WritingApplication',
    operatingSystem: 'Web, Windows',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    url: 'https://inkwell.enterthelimelight.com',
    description:
      'Free local-first writing software for novels: chapter-first drafting, offline manuscript storage, and unlocked EPUB, print-ready PDF, DOCX, and Markdown exports. No account or subscription.',
    publisher: STUDIO,
    featureList: [
      'Chapter-first novel editor',
      'Local-only manuscript storage',
      'No account required',
      'EPUB, print-ready PDF, DOCX, and Markdown exports',
      'Offline-friendly web and Windows desktop apps',
    ],
  }
}

export function landmarkSoftwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Landmark',
    applicationCategory: 'TravelApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    url: 'https://landmark.enterthelimelight.com',
    description:
      'Swipe-to-discover web app for finding cool things nearby: historical attractions, food and drink, and hidden gems within a custom radius. Save places you like; skip the rest.',
    publisher: STUDIO,
    featureList: [
      'Tinder-style swipe discovery for places',
      'Historical attractions, food and drink, and hidden gems',
      'Location and radius-based results worldwide',
      'Save and revisit places you swipe right on',
      'Extended place details before you decide',
    ],
  }
}

export function articleJsonLd(options: {
  title: string
  description: string
  url: string
  datePublished: Date
  dateModified?: Date
  tags?: string[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: options.title,
    description: options.description,
    datePublished: options.datePublished.toISOString(),
    dateModified: (options.dateModified ?? options.datePublished).toISOString(),
    author: {
      '@type': 'Person',
      name: 'Steven Spacek Jr.',
    },
    publisher: STUDIO,
    mainEntityOfPage: options.url,
    keywords: options.tags?.join(', '),
  }
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
