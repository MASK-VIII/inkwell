import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, type PDFFont } from 'pdf-lib'
import type { InkwellFontCatalogRow, InkwellFontId } from '../fonts/fontCatalog'
import { DEFAULT_BODY_FONT_ID, FONT_CATALOG, isInkwellFontId } from '../fonts/fontCatalog'

export type PrintFaceVariant = 'regular' | 'bold' | 'italic' | 'boldItalic'

const variantBytesCache = new Map<string, Uint8Array>()

function resolveFontId(id: InkwellFontId | undefined): InkwellFontId {
  return id && isInkwellFontId(id) ? id : DEFAULT_BODY_FONT_ID
}

function variantKey(fid: InkwellFontId, variant: PrintFaceVariant): string {
  return `${fid}:${variant}`
}

export async function getPrintFontBytesForVariant(
  id: InkwellFontId | undefined,
  variant: PrintFaceVariant,
): Promise<Uint8Array> {
  const fid = resolveFontId(id)
  const key = variantKey(fid, variant)
  const hit = variantBytesCache.get(key)
  if (hit) return hit

  const row = FONT_CATALOG[fid] as InkwellFontCatalogRow
  const url =
    variant === 'regular' ? row.printFontUrl
    : variant === 'bold' ? (row.printFontUrlBold ?? row.printFontUrl)
    : variant === 'italic' ? (row.printFontUrlItalic ?? row.printFontUrl)
    : (row.printFontUrlBoldItalic ?? row.printFontUrlBold ?? row.printFontUrlItalic ?? row.printFontUrl)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load print font ${fid} ${variant} (${res.status})`)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  variantBytesCache.set(key, bytes)
  return bytes
}

export async function getPrintFontBytes(id?: InkwellFontId): Promise<Uint8Array> {
  return getPrintFontBytesForVariant(id, 'regular')
}

export async function getPrintFontForMeasurement(
  id?: InkwellFontId,
): Promise<{ pdf: PDFDocument; font: PDFFont }> {
  const bytes = await getPrintFontBytes(id)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(bytes, { subset: false })
  return { pdf, font }
}

export async function getPrintFontForPdf(pdf: PDFDocument, id?: InkwellFontId): Promise<PDFFont> {
  const bytes = await getPrintFontBytes(id)
  pdf.registerFontkit(fontkit)
  return await pdf.embedFont(bytes, { subset: false })
}

export type PrintFontEmbeddingSet = {
  pdf?: PDFDocument
  body: PDFFont
  title: PDFFont
  bodyBold: PDFFont
  bodyItalic: PDFFont
  bodyBoldItalic: PDFFont
  /**
   * True when the catalog has no dedicated bold file (`printFontUrlBold`).
   * Browser preview faux-bolds via font-weight; PDF must emulate bold when drawing those spans.
   */
  bodyBoldIsSynthetic: boolean
  /**
   * True when the catalog has no dedicated italic file (`printFontUrlItalic`).
   * PDF uses skew (`xSkew`) to approximate oblique; pagination widens segments slightly.
   */
  bodyItalicIsSynthetic: boolean
}

/** KDP PDF: chapter-title face variants + synthetic flags (same rules as body). */
export type PdfExportFonts = PrintFontEmbeddingSet & {
  titleBold: PDFFont
  titleItalic: PDFFont
  titleBoldItalic: PDFFont
  titleBoldIsSynthetic: boolean
  titleItalicIsSynthetic: boolean
}

/**
 * Embed body (regular/bold/italic/boldItalic) and chapter-title regular into one PDF doc
 * for measurement during pagination.
 */
export async function getPrintFontPairForMeasurement(
  bodyId?: InkwellFontId,
  titleId?: InkwellFontId,
): Promise<PrintFontEmbeddingSet & { pdf: PDFDocument }> {
  const bId = resolveFontId(bodyId)
  const tId = resolveFontId(titleId)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  const embedVariant = async (id: InkwellFontId, v: PrintFaceVariant) => {
    const bytes = await getPrintFontBytesForVariant(id, v)
    return pdf.embedFont(bytes, { subset: false })
  }

  const body = await embedVariant(bId, 'regular')
  const bodyBold = await embedVariant(bId, 'bold')
  const bodyItalic = await embedVariant(bId, 'italic')
  const bodyBoldItalic = await embedVariant(bId, 'boldItalic')

  let title = body
  if (tId !== bId) {
    title = await embedVariant(tId, 'regular')
  }

  const row = FONT_CATALOG[bId] as InkwellFontCatalogRow
  /** If pdf-lib reuses one embedded font for multiple variants, draw faux bold/italic like a missing file. */
  const bodyBoldIsSynthetic = !row.printFontUrlBold || body === bodyBold
  const bodyItalicIsSynthetic = !row.printFontUrlItalic || body === bodyItalic

  return {
    pdf,
    body,
    title,
    bodyBold,
    bodyItalic,
    bodyBoldItalic,
    bodyBoldIsSynthetic,
    bodyItalicIsSynthetic,
  }
}

/** PDF export: embed body + chapter-title faces (all variants used for inline marks). */
export async function getPrintFontPairForPdf(
  pdf: PDFDocument,
  bodyId?: InkwellFontId,
  titleId?: InkwellFontId,
): Promise<PdfExportFonts> {
  const bId = resolveFontId(bodyId)
  const tId = resolveFontId(titleId)
  pdf.registerFontkit(fontkit)

  const embedVariant = async (id: InkwellFontId, v: PrintFaceVariant) => {
    const bytes = await getPrintFontBytesForVariant(id, v)
    return pdf.embedFont(bytes, { subset: false })
  }

  const body = await embedVariant(bId, 'regular')
  const bodyBold = await embedVariant(bId, 'bold')
  const bodyItalic = await embedVariant(bId, 'italic')
  const bodyBoldItalic = await embedVariant(bId, 'boldItalic')

  const row = FONT_CATALOG[bId] as InkwellFontCatalogRow
  const bodyBoldIsSynthetic = !row.printFontUrlBold || body === bodyBold
  const bodyItalicIsSynthetic = !row.printFontUrlItalic || body === bodyItalic

  let title = body
  let titleBold = bodyBold
  let titleItalic = bodyItalic
  let titleBoldItalic = bodyBoldItalic
  let titleBoldIsSynthetic = bodyBoldIsSynthetic
  let titleItalicIsSynthetic = bodyItalicIsSynthetic

  if (tId !== bId) {
    title = await embedVariant(tId, 'regular')
    titleBold = await embedVariant(tId, 'bold')
    titleItalic = await embedVariant(tId, 'italic')
    titleBoldItalic = await embedVariant(tId, 'boldItalic')
    const rowT = FONT_CATALOG[tId] as InkwellFontCatalogRow
    titleBoldIsSynthetic = !rowT.printFontUrlBold || title === titleBold
    titleItalicIsSynthetic = !rowT.printFontUrlItalic || title === titleItalic
  }

  return {
    body,
    title,
    bodyBold,
    bodyItalic,
    bodyBoldItalic,
    bodyBoldIsSynthetic,
    bodyItalicIsSynthetic,
    titleBold,
    titleItalic,
    titleBoldItalic,
    titleBoldIsSynthetic,
    titleItalicIsSynthetic,
  }
}
