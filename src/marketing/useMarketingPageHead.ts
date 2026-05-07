import { useEffect } from 'react'
import { INKWELL_MARKETING_HOST } from './marketingRouting'

type HeadOptions = {
  /** `<title>` value while this page is mounted. Restored on unmount. */
  title: string
  /** Canonical path relative to `https://${INKWELL_MARKETING_HOST}` (e.g. `/pricing`). */
  canonicalPath: string
  /** Optional OG description override. */
  ogDescription?: string
}

const PREVIOUS_TITLE_FALLBACK = 'Inkwell'

/**
 * Per-page `<title>`, `<link rel="canonical">`, and `og:url` updates for the marketing surfaces.
 * Restores the previous values on unmount so navigating between marketing pages stays clean.
 */
export function useMarketingPageHead({ title, canonicalPath, ogDescription }: HeadOptions): void {
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

    let previousOgDescription: string | null = null
    let ogDescriptionEl: HTMLMetaElement | null = null
    if (ogDescription !== undefined) {
      ogDescriptionEl = ensureMetaTagByProperty('og:description')
      previousOgDescription = ogDescriptionEl.getAttribute('content')
      ogDescriptionEl.setAttribute('content', ogDescription)
    }

    return () => {
      document.title = previousTitle || PREVIOUS_TITLE_FALLBACK
      if (previousCanonical != null) canonicalEl.setAttribute('href', previousCanonical)
      else canonicalEl.removeAttribute('href')
      if (previousOgUrl != null) ogUrlEl.setAttribute('content', previousOgUrl)
      else ogUrlEl.removeAttribute('content')
      if (ogDescriptionEl) {
        if (previousOgDescription != null) ogDescriptionEl.setAttribute('content', previousOgDescription)
        else ogDescriptionEl.removeAttribute('content')
      }
    }
  }, [title, canonicalPath, ogDescription])
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
