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
