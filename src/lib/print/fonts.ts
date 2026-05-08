import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, type PDFFont } from 'pdf-lib'
import type { InkwellFontId } from '../fonts/fontCatalog'
import { DEFAULT_BODY_FONT_ID, FONT_CATALOG, isInkwellFontId } from '../fonts/fontCatalog'

const bytesCache = new Map<InkwellFontId, Uint8Array>()

function resolveFontId(id: InkwellFontId | undefined): InkwellFontId {
  return id && isInkwellFontId(id) ? id : DEFAULT_BODY_FONT_ID
}

export async function getPrintFontBytes(id?: InkwellFontId): Promise<Uint8Array> {
  const fid = resolveFontId(id)
  const hit = bytesCache.get(fid)
  if (hit) return hit

  const url = FONT_CATALOG[fid].printFontUrl
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load print font ${fid} (${res.status})`)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  bytesCache.set(fid, bytes)
  return bytes
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

/**
 * Embed both the body font and the (optional) chapter-title font into a single throwaway
 * `PDFDocument` used for measurement during pagination. When `titleId` resolves to the
 * same font as `bodyId`, the same `PDFFont` instance is returned for both slots so we
 * don't pay the embed cost twice.
 */
export async function getPrintFontPairForMeasurement(
  bodyId?: InkwellFontId,
  titleId?: InkwellFontId,
): Promise<{ pdf: PDFDocument; body: PDFFont; title: PDFFont }> {
  const bId = resolveFontId(bodyId)
  const tId = resolveFontId(titleId)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const bodyBytes = await getPrintFontBytes(bId)
  const body = await pdf.embedFont(bodyBytes, { subset: false })
  if (tId === bId) {
    return { pdf, body, title: body }
  }
  const titleBytes = await getPrintFontBytes(tId)
  const title = await pdf.embedFont(titleBytes, { subset: false })
  return { pdf, body, title }
}

/**
 * PDF-export equivalent of {@link getPrintFontPairForMeasurement}: embeds body and
 * title fonts into the supplied `PDFDocument`, reusing one `PDFFont` instance when
 * the two ids resolve to the same font.
 */
export async function getPrintFontPairForPdf(
  pdf: PDFDocument,
  bodyId?: InkwellFontId,
  titleId?: InkwellFontId,
): Promise<{ body: PDFFont; title: PDFFont }> {
  const bId = resolveFontId(bodyId)
  const tId = resolveFontId(titleId)
  pdf.registerFontkit(fontkit)
  const bodyBytes = await getPrintFontBytes(bId)
  const body = await pdf.embedFont(bodyBytes, { subset: false })
  if (tId === bId) return { body, title: body }
  const titleBytes = await getPrintFontBytes(tId)
  const title = await pdf.embedFont(titleBytes, { subset: false })
  return { body, title }
}
