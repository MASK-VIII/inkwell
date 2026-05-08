/** Best-effort intrinsic dimensions for print layout (browser / worker safe). */

const DIM_CACHE = new Map<string, { w: number; h: number } | null>()

function decodeBase64Payload(dataUrl: string): Uint8Array | null {
  const m = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUrl.trim())
  if (!m?.[2]) return null
  try {
    const bin = atob(m[2])
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function readPngDims(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 24) return null
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null
  const w = (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!
  const h = (bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!
  if (w <= 0 || h <= 0 || w > 65535 || h > 65535) return null
  return { w, h }
}

/** JPEG SOF0 / SOF2 — height then width at fixed offset after marker. */
function readJpegDims(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++
      continue
    }
    while (i < bytes.length && bytes[i] === 0xff) i++
    const marker = bytes[i++] ?? 0
    if (marker === 0xd8 || marker === 0xd9) continue
    const len = ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0)
    if (len < 2 || i + len > bytes.length) return null
    if (marker >= 0xc0 && marker <= 0xc3) {
      const h = ((bytes[i + 3] ?? 0) << 8) | (bytes[i + 4] ?? 0)
      const w = ((bytes[i + 5] ?? 0) << 8) | (bytes[i + 6] ?? 0)
      if (w > 0 && h > 0) return { w, h }
      return null
    }
    i += len
  }
  return null
}

export function rasterDimsFromDataUrl(src: string): { w: number; h: number } | null {
  const key = src.trim()
  const cached = DIM_CACHE.get(key)
  if (cached !== undefined) return cached

  const lower = key.toLowerCase()
  const bytes = decodeBase64Payload(src)
  if (!bytes) {
    DIM_CACHE.set(key, null)
    return null
  }
  const dims =
    lower.includes('image/png') ? readPngDims(bytes)
    : lower.includes('image/jpeg') || lower.includes('image/jpg') ? readJpegDims(bytes)
    : readPngDims(bytes) ?? readJpegDims(bytes)
  DIM_CACHE.set(key, dims)
  return dims
}

export function figureDisplayPts(
  src: string | null,
  contentWidthPt: number,
  fallbackRatio = 3 / 4,
): { widthPt: number; heightPt: number } {
  const dims = src ? rasterDimsFromDataUrl(src) : null
  const iw = dims?.w ?? 800
  const ih = dims?.h ?? Math.round(800 / fallbackRatio)
  const maxW = Math.max(40, contentWidthPt)
  const scale = iw > 0 ? Math.min(1, maxW / iw) : 1
  return { widthPt: iw * scale, heightPt: ih * scale }
}
