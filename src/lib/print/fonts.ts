import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, type PDFFont } from 'pdf-lib'

// Vite will copy this font file to the build output and give us a URL.
import dejaVuSerifUrl from 'dejavu-fonts-ttf/ttf/DejaVuSerif.ttf?url'

let cachedFontBytes: Uint8Array | null = null

async function loadFontBytes(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes

  const res = await fetch(dejaVuSerifUrl)
  if (!res.ok) throw new Error(`Failed to load serif font (${res.status})`)
  const buf = await res.arrayBuffer()
  cachedFontBytes = new Uint8Array(buf)
  return cachedFontBytes
}

export async function getPrintFontForMeasurement(): Promise<{ pdf: PDFDocument; font: PDFFont }> {
  const bytes = await loadFontBytes()
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(bytes, { subset: false })
  return { pdf, font }
}

export async function getPrintFontForPdf(pdf: PDFDocument): Promise<PDFFont> {
  const bytes = await loadFontBytes()
  pdf.registerFontkit(fontkit)
  return await pdf.embedFont(bytes, { subset: false })
}

