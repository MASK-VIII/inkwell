import cinzelWoff2 from '@fontsource/cinzel/files/cinzel-latin-400-normal.woff2?url'
import dejaVuSansCondensedUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansCondensed.ttf?url'
import dejaVuSansMonoUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf?url'
import dejaVuSansUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url'
import dejaVuSerifCondensedUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerifCondensed.ttf?url'
import dejaVuSerifUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerif.ttf?url'
import ebGaramondWoff2 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url'
import greatVibesWoff2 from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url'
import interWoff2 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import libreBaskervilleWoff2 from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2?url'
import loraWoff2 from '@fontsource/lora/files/lora-latin-400-normal.woff2?url'
import playfairDisplayWoff2 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url'
import sourceSans3Woff2 from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2?url'

export type FontStackKind = 'serif' | 'sans' | 'mono'

export type InkwellFontCatalogRow = {
  label: string
  category: string
  license: string
  cssFamily: string
  stackKind: FontStackKind
  supportsPrint: boolean
  supportsEbook: boolean
  printFontUrl: string
  ebookFontUrl: string
  epubFilename: string
}

export const FONT_CATALOG = {
  dejavu_serif: {
    label: 'DejaVu Serif',
    category: 'Workhorse',
    license: 'Bitstream Vera / DejaVu (free)',
    cssFamily: 'DejaVu Serif',
    stackKind: 'serif',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: dejaVuSerifUrl,
    ebookFontUrl: dejaVuSerifUrl,
    epubFilename: 'InkwellDejaVuSerif.ttf',
  },
  dejavu_sans: {
    label: 'DejaVu Sans',
    category: 'Workhorse',
    license: 'Bitstream Vera / DejaVu (free)',
    cssFamily: 'DejaVu Sans',
    stackKind: 'sans',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: dejaVuSansUrl,
    ebookFontUrl: dejaVuSansUrl,
    epubFilename: 'InkwellDejaVuSans.ttf',
  },
  dejavu_serif_condensed: {
    label: 'DejaVu Serif Condensed',
    category: 'Workhorse',
    license: 'Bitstream Vera / DejaVu (free)',
    cssFamily: 'DejaVu Serif Condensed',
    stackKind: 'serif',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: dejaVuSerifCondensedUrl,
    ebookFontUrl: dejaVuSerifCondensedUrl,
    epubFilename: 'InkwellDejaVuSerifCondensed.ttf',
  },
  dejavu_sans_condensed: {
    label: 'DejaVu Sans Condensed',
    category: 'Workhorse',
    license: 'Bitstream Vera / DejaVu (free)',
    cssFamily: 'DejaVu Sans Condensed',
    stackKind: 'sans',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: dejaVuSansCondensedUrl,
    ebookFontUrl: dejaVuSansCondensedUrl,
    epubFilename: 'InkwellDejaVuSansCondensed.ttf',
  },
  dejavu_sans_mono: {
    label: 'DejaVu Sans Mono',
    category: 'Workhorse',
    license: 'Bitstream Vera / DejaVu (free)',
    cssFamily: 'DejaVu Sans Mono',
    stackKind: 'mono',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: dejaVuSansMonoUrl,
    ebookFontUrl: dejaVuSansMonoUrl,
    epubFilename: 'InkwellDejaVuSansMono.ttf',
  },
  eb_garamond: {
    label: 'EB Garamond',
    category: 'Literary',
    license: 'OFL-1.1',
    cssFamily: 'EB Garamond',
    stackKind: 'serif',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: ebGaramondWoff2,
    ebookFontUrl: ebGaramondWoff2,
    epubFilename: 'InkwellEBGaramond.woff2',
  },
  lora: {
    label: 'Lora',
    category: 'Literary',
    license: 'OFL-1.1',
    cssFamily: 'Lora',
    stackKind: 'serif',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: loraWoff2,
    ebookFontUrl: loraWoff2,
    epubFilename: 'InkwellLora.woff2',
  },
  libre_baskerville: {
    label: 'Libre Baskerville',
    category: 'Literary',
    license: 'OFL-1.1',
    cssFamily: 'Libre Baskerville',
    stackKind: 'serif',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: libreBaskervilleWoff2,
    ebookFontUrl: libreBaskervilleWoff2,
    epubFilename: 'InkwellLibreBaskerville.woff2',
  },
  inter: {
    label: 'Inter',
    category: 'Contemporary',
    license: 'OFL-1.1',
    cssFamily: 'Inter',
    stackKind: 'sans',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: interWoff2,
    ebookFontUrl: interWoff2,
    epubFilename: 'InkwellInter.woff2',
  },
  source_sans_3: {
    label: 'Source Sans 3',
    category: 'Contemporary',
    license: 'OFL-1.1',
    cssFamily: 'Source Sans 3',
    stackKind: 'sans',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: sourceSans3Woff2,
    ebookFontUrl: sourceSans3Woff2,
    epubFilename: 'InkwellSourceSans3.woff2',
  },
  cinzel: {
    label: 'Cinzel',
    category: 'Display',
    license: 'OFL-1.1',
    cssFamily: 'Cinzel',
    stackKind: 'serif',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: cinzelWoff2,
    ebookFontUrl: cinzelWoff2,
    epubFilename: 'InkwellCinzel.woff2',
  },
  playfair_display: {
    label: 'Playfair Display',
    category: 'Display',
    license: 'OFL-1.1',
    cssFamily: 'Playfair Display',
    stackKind: 'serif',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: playfairDisplayWoff2,
    ebookFontUrl: playfairDisplayWoff2,
    epubFilename: 'InkwellPlayfairDisplay.woff2',
  },
  great_vibes: {
    label: 'Great Vibes',
    category: 'Display',
    license: 'OFL-1.1',
    cssFamily: 'Great Vibes',
    stackKind: 'serif',
    supportsPrint: true,
    supportsEbook: true,
    printFontUrl: greatVibesWoff2,
    ebookFontUrl: greatVibesWoff2,
    epubFilename: 'InkwellGreatVibes.woff2',
  },
} as const satisfies Record<string, InkwellFontCatalogRow>

export type InkwellFontId = keyof typeof FONT_CATALOG

export type InkwellFontCatalogEntry = InkwellFontCatalogRow & { id: InkwellFontId }

export const DEFAULT_BODY_FONT_ID: InkwellFontId = 'dejavu_serif'

export const INKWELL_FONT_IDS = Object.keys(FONT_CATALOG) as InkwellFontId[]

export function getFontCatalogEntry(id: string): InkwellFontCatalogEntry | null {
  if (!(id in FONT_CATALOG)) return null
  const fid = id as InkwellFontId
  return { id: fid, ...FONT_CATALOG[fid] }
}

export function isInkwellFontId(id: string): id is InkwellFontId {
  return id in FONT_CATALOG
}

export function coerceInkwellFontId(bodyFontId: unknown, legacyFontFamily: unknown): InkwellFontId {
  if (typeof bodyFontId === 'string' && isInkwellFontId(bodyFontId)) return bodyFontId
  if (legacyFontFamily === 'serif' || legacyFontFamily === undefined) return DEFAULT_BODY_FONT_ID
  return DEFAULT_BODY_FONT_ID
}

function formatForUrl(url: string): 'woff2' | 'truetype' {
  return url.endsWith('.woff2') || url.includes('.woff2?') ? 'woff2' : 'truetype'
}

export function genericFontFallback(kind: FontStackKind): string {
  switch (kind) {
    case 'sans':
      return 'system-ui, "Segoe UI", Roboto, sans-serif'
    case 'mono':
      return '"Courier New", Courier, monospace'
    default:
      return 'Georgia, "Times New Roman", serif'
  }
}

/** @font-face for on-screen print preview (same URL as print pipeline). */
export function buildPrintPreviewFontFaceCss(id: InkwellFontId): string {
  const e = FONT_CATALOG[id]
  const fmt = formatForUrl(e.printFontUrl)
  return `@font-face{font-family:${JSON.stringify(e.cssFamily)};src:url(${JSON.stringify(e.printFontUrl)}) format('${fmt}');font-weight:400;font-style:normal;font-display:swap;}`
}

export function printPreviewFontFamilyStack(id: InkwellFontId): string {
  const e = FONT_CATALOG[id]
  return `${JSON.stringify(e.cssFamily)}, ${genericFontFallback(e.stackKind)}`
}

export function listFontsByCategory(): { category: string; fonts: InkwellFontCatalogEntry[] }[] {
  const order = new Map<string, number>()
  const groups: { category: string; fonts: InkwellFontCatalogEntry[] }[] = []
  for (const id of INKWELL_FONT_IDS) {
    const row = FONT_CATALOG[id]
    if (!order.has(row.category)) {
      order.set(row.category, groups.length)
      groups.push({ category: row.category, fonts: [] })
    }
    groups[order.get(row.category)!]!.fonts.push({ id, ...row })
  }
  for (const g of groups) {
    g.fonts.sort((a, b) => a.label.localeCompare(b.label))
  }
  return groups
}
