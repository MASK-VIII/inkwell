import { useEffect } from 'react'
import { INKWELL_MARKETING_HOST } from './marketingRouting'

type HeadOptions = {
  /** `<title>` value while this page is mounted. Restored on unmount. */
  title: string
  /** Canonical path relative to `https://${INKWELL_MARKETING_HOST}` (e.g. `/pricing`). */
  canonicalPath: string
  /** `<meta name="description">` — improves snippets when set per route. */
  metaDescription?: string
  /** `og:title` / social headline; defaults to `title`. */
  ogTitle?: string
  /** Open Graph description; also used for `twitter:description` unless overridden. */
  ogDescription?: string
  /** `twitter:title`; defaults to `ogTitle` then `title`. */
  twitterTitle?: string
  /** `twitter:description`; defaults to `ogDescription`. */
  twitterDescription?: string
  /** Absolute image URL for `og:image` and `twitter:image`. */
  ogImage?: string
  /** `meta name="robots"` e.g. `noindex, nofollow` for error pages. */
  robots?: string
}

const PREVIOUS_TITLE_FALLBACK = 'Inkwell'

const DEFAULT_OG_IMAGE = `https://${INKWELL_MARKETING_HOST}/brand/inkwell-emblem.png?v=2`

/**
 * Per-route document head for marketing: title, canonical, meta description, OG/Twitter.
 * Restores previous values on unmount so client navigation between pages stays clean.
 */
export function useMarketingPageHead(options: HeadOptions): void {
  const {
    title,
    canonicalPath,
    metaDescription,
    ogTitle,
    ogDescription,
    twitterTitle,
    twitterDescription,
    ogImage,
    robots,
  } = options

  useEffect(() => {
    if (typeof document === 'undefined') return

    const previousTitle = document.title
    document.title = title

    const canonicalUrl = `https://${INKWELL_MARKETING_HOST}${canonicalPath}`

    const canonicalEl = ensureLinkTag('canonical')
    const previousCanonical = canonicalEl.getAttribute('href')
    canonicalEl.setAttribute('href', canonicalUrl)

    const ogUrlEl = ensureMetaTagByProperty('og:url')
    const previousOgUrl = ogUrlEl.getAttribute('content')
    ogUrlEl.setAttribute('content', canonicalUrl)

    const resolvedOgTitle = ogTitle ?? title
    const ogTitleEl = ensureMetaTagByProperty('og:title')
    const previousOgTitle = ogTitleEl.getAttribute('content')
    ogTitleEl.setAttribute('content', resolvedOgTitle)

    const resolvedTwitterTitle = twitterTitle ?? resolvedOgTitle
    const twitterTitleEl = ensureMetaTagByName('twitter:title')
    const previousTwitterTitle = twitterTitleEl.getAttribute('content')
    twitterTitleEl.setAttribute('content', resolvedTwitterTitle)

    let metaDescEl: HTMLMetaElement | null = null
    let previousMetaDesc: string | null = null
    if (metaDescription !== undefined) {
      metaDescEl = ensureMetaTagByName('description')
      previousMetaDesc = metaDescEl.getAttribute('content')
      metaDescEl.setAttribute('content', metaDescription)
    }

    let ogDescriptionEl: HTMLMetaElement | null = null
    let previousOgDescription: string | null = null
    let twitterDescEl: HTMLMetaElement | null = null
    let previousTwitterDesc: string | null = null
    if (ogDescription !== undefined) {
      ogDescriptionEl = ensureMetaTagByProperty('og:description')
      previousOgDescription = ogDescriptionEl.getAttribute('content')
      ogDescriptionEl.setAttribute('content', ogDescription)

      const twDesc = twitterDescription ?? ogDescription
      twitterDescEl = ensureMetaTagByName('twitter:description')
      previousTwitterDesc = twitterDescEl.getAttribute('content')
      twitterDescEl.setAttribute('content', twDesc)
    } else if (twitterDescription !== undefined) {
      twitterDescEl = ensureMetaTagByName('twitter:description')
      previousTwitterDesc = twitterDescEl.getAttribute('content')
      twitterDescEl.setAttribute('content', twitterDescription)
    }

    const imageUrl = ogImage ?? DEFAULT_OG_IMAGE
    const ogImageEl = ensureMetaTagByProperty('og:image')
    const previousOgImage = ogImageEl.getAttribute('content')
    ogImageEl.setAttribute('content', imageUrl)

    const twitterImageEl = ensureMetaTagByName('twitter:image')
    const previousTwitterImage = twitterImageEl.getAttribute('content')
    twitterImageEl.setAttribute('content', imageUrl)

    let robotsEl: HTMLMetaElement | null = null
    let previousRobots: string | null = null
    if (robots !== undefined) {
      robotsEl = ensureMetaTagByName('robots')
      previousRobots = robotsEl.getAttribute('content')
      robotsEl.setAttribute('content', robots)
    }

    return () => {
      document.title = previousTitle || PREVIOUS_TITLE_FALLBACK
      if (previousCanonical != null) canonicalEl.setAttribute('href', previousCanonical)
      else canonicalEl.removeAttribute('href')
      if (previousOgUrl != null) ogUrlEl.setAttribute('content', previousOgUrl)
      else ogUrlEl.removeAttribute('content')
      if (previousOgTitle != null) ogTitleEl.setAttribute('content', previousOgTitle)
      else ogTitleEl.removeAttribute('content')
      if (previousTwitterTitle != null) twitterTitleEl.setAttribute('content', previousTwitterTitle)
      else twitterTitleEl.removeAttribute('content')
      if (metaDescEl) {
        if (previousMetaDesc != null) metaDescEl.setAttribute('content', previousMetaDesc)
        else metaDescEl.removeAttribute('content')
      }
      if (ogDescriptionEl) {
        if (previousOgDescription != null) ogDescriptionEl.setAttribute('content', previousOgDescription)
        else ogDescriptionEl.removeAttribute('content')
      }
      if (twitterDescEl) {
        if (previousTwitterDesc != null) twitterDescEl.setAttribute('content', previousTwitterDesc)
        else twitterDescEl.removeAttribute('content')
      }
      if (previousOgImage != null) ogImageEl.setAttribute('content', previousOgImage)
      else ogImageEl.removeAttribute('content')
      if (previousTwitterImage != null) twitterImageEl.setAttribute('content', previousTwitterImage)
      else twitterImageEl.removeAttribute('content')
      if (robotsEl) {
        if (previousRobots != null) robotsEl.setAttribute('content', previousRobots)
        else robotsEl.removeAttribute('content')
      }
    }
  }, [
    title,
    canonicalPath,
    metaDescription,
    ogTitle,
    ogDescription,
    twitterTitle,
    twitterDescription,
    ogImage,
    robots,
  ])
}

function ensureLinkTag(rel: string): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  return el
}

function ensureMetaTagByProperty(property: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  return el
}

function ensureMetaTagByName(name: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  return el
}
