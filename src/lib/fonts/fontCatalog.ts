import cinzelWoff2 from '@fontsource/cinzel/files/cinzel-latin-400-normal.woff2?url'
import cinzelBoldWoff2 from '@fontsource/cinzel/files/cinzel-latin-700-normal.woff2?url'
import dejaVuSansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url'
import dejaVuSansBoldObliqueUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-BoldOblique.ttf?url'
import dejaVuSansCondensedBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansCondensed-Bold.ttf?url'
import dejaVuSansCondensedBoldObliqueUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansCondensed-BoldOblique.ttf?url'
import dejaVuSansCondensedObliqueUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansCondensed-Oblique.ttf?url'
import dejaVuSansCondensedUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansCondensed.ttf?url'
import dejaVuSansMonoBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-Bold.ttf?url'
import dejaVuSansMonoBoldObliqueUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-BoldOblique.ttf?url'
import dejaVuSansMonoObliqueUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-Oblique.ttf?url'
import dejaVuSansMonoUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf?url'
import dejaVuSansObliqueUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf?url'
import dejaVuSansUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url'
import dejaVuSerifBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf?url'
import dejaVuSerifBoldItalicUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerif-BoldItalic.ttf?url'
import dejaVuSerifCondensedBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerifCondensed-Bold.ttf?url'
import dejaVuSerifCondensedBoldItalicUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerifCondensed-BoldItalic.ttf?url'
import dejaVuSerifCondensedItalicUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerifCondensed-Italic.ttf?url'
import dejaVuSerifCondensedUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerifCondensed.ttf?url'
import dejaVuSerifItalicUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerif-Italic.ttf?url'
import dejaVuSerifUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerif.ttf?url'
import ebGaramondBoldItalicWoff2 from '@fontsource/eb-garamond/files/eb-garamond-latin-700-italic.woff2?url'
import ebGaramondBoldWoff2 from '@fontsource/eb-garamond/files/eb-garamond-latin-700-normal.woff2?url'
import ebGaramondItalicWoff2 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2?url'
import ebGaramondWoff2 from '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url'
import greatVibesWoff2 from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url'
import interBoldItalicWoff2 from '@fontsource/inter/files/inter-latin-700-italic.woff2?url'
import interBoldWoff2 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url'
import interItalicWoff2 from '@fontsource/inter/files/inter-latin-400-italic.woff2?url'
import interWoff2 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import libreBaskervilleBoldItalicWoff2 from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-italic.woff2?url'
import libreBaskervilleBoldWoff2 from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff2?url'
import libreBaskervilleItalicWoff2 from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff2?url'
import libreBaskervilleWoff2 from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2?url'
import loraBoldItalicWoff2 from '@fontsource/lora/files/lora-latin-700-italic.woff2?url'
import loraBoldWoff2 from '@fontsource/lora/files/lora-latin-700-normal.woff2?url'
import loraItalicWoff2 from '@fontsource/lora/files/lora-latin-400-italic.woff2?url'
import loraWoff2 from '@fontsource/lora/files/lora-latin-400-normal.woff2?url'
import playfairDisplayBoldItalicWoff2 from '@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2?url'
import playfairDisplayBoldWoff2 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url'
import playfairDisplayItalicWoff2 from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url'
import playfairDisplayWoff2 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url'
import sourceSans3BoldItalicWoff2 from '@fontsource/source-sans-3/files/source-sans-3-latin-700-italic.woff2?url'
import sourceSans3BoldWoff2 from '@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff2?url'
import sourceSans3ItalicWoff2 from '@fontsource/source-sans-3/files/source-sans-3-latin-400-italic.woff2?url'
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
  /** Optional faces for PDF / print inline bold-italic (fallback: regular). */
  printFontUrlBold?: string
  printFontUrlItalic?: string
  printFontUrlBoldItalic?: string
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
    printFontUrlBold: dejaVuSerifBoldUrl,
    printFontUrlItalic: dejaVuSerifItalicUrl,
    printFontUrlBoldItalic: dejaVuSerifBoldItalicUrl,
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
    printFontUrlBold: dejaVuSansBoldUrl,
    printFontUrlItalic: dejaVuSansObliqueUrl,
    printFontUrlBoldItalic: dejaVuSansBoldObliqueUrl,
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
    printFontUrlBold: dejaVuSerifCondensedBoldUrl,
    printFontUrlItalic: dejaVuSerifCondensedItalicUrl,
    printFontUrlBoldItalic: dejaVuSerifCondensedBoldItalicUrl,
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
    printFontUrlBold: dejaVuSansCondensedBoldUrl,
    printFontUrlItalic: dejaVuSansCondensedObliqueUrl,
    printFontUrlBoldItalic: dejaVuSansCondensedBoldObliqueUrl,
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
    printFontUrlBold: dejaVuSansMonoBoldUrl,
    printFontUrlItalic: dejaVuSansMonoObliqueUrl,
    printFontUrlBoldItalic: dejaVuSansMonoBoldObliqueUrl,
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
    printFontUrlBold: ebGaramondBoldWoff2,
    printFontUrlItalic: ebGaramondItalicWoff2,
    printFontUrlBoldItalic: ebGaramondBoldItalicWoff2,
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
    printFontUrlBold: loraBoldWoff2,
    printFontUrlItalic: loraItalicWoff2,
    printFontUrlBoldItalic: loraBoldItalicWoff2,
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
    printFontUrlBold: libreBaskervilleBoldWoff2,
    printFontUrlItalic: libreBaskervilleItalicWoff2,
    printFontUrlBoldItalic: libreBaskervilleBoldItalicWoff2,
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
    printFontUrlBold: interBoldWoff2,
    printFontUrlItalic: interItalicWoff2,
    printFontUrlBoldItalic: interBoldItalicWoff2,
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
    printFontUrlBold: sourceSans3BoldWoff2,
    printFontUrlItalic: sourceSans3ItalicWoff2,
    printFontUrlBoldItalic: sourceSans3BoldItalicWoff2,
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
    printFontUrlBold: cinzelBoldWoff2,
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
    printFontUrlBold: playfairDisplayBoldWoff2,
    printFontUrlItalic: playfairDisplayItalicWoff2,
    printFontUrlBoldItalic: playfairDisplayBoldItalicWoff2,
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

/** Which dedicated print font files exist (PDF embed + preview @font-face). */
export type PrintFaceAvailability = {
  hasDedicatedBold: boolean
  hasDedicatedItalic: boolean
  hasDedicatedBoldItalic: boolean
}

export function getPrintFaceAvailability(id: InkwellFontId): PrintFaceAvailability {
  const row = FONT_CATALOG[id] as InkwellFontCatalogRow
  return {
    hasDedicatedBold: Boolean(row.printFontUrlBold),
    hasDedicatedItalic: Boolean(row.printFontUrlItalic),
    hasDedicatedBoldItalic: Boolean(row.printFontUrlBoldItalic),
  }
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

/** @font-face for on-screen print preview (regular + optional bold/italic faces). */
export function buildPrintPreviewFontFaceCss(id: InkwellFontId): string {
  const e = FONT_CATALOG[id] as InkwellFontCatalogRow
  const fam = JSON.stringify(e.cssFamily)
  const faces: string[] = []
  const push = (url: string, weight: number, style: 'normal' | 'italic') => {
    const fmt = formatForUrl(url)
    faces.push(
      `@font-face{font-family:${fam};src:url(${JSON.stringify(url)}) format('${fmt}');font-weight:${weight};font-style:${style};font-display:swap;}`,
    )
  }
  push(e.printFontUrl, 400, 'normal')
  if (e.printFontUrlItalic) push(e.printFontUrlItalic, 400, 'italic')
  if (e.printFontUrlBold) push(e.printFontUrlBold, 700, 'normal')
  if (e.printFontUrlBoldItalic) push(e.printFontUrlBoldItalic, 700, 'italic')
  return faces.join('\n')
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
