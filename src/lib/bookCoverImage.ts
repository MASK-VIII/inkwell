/** Max source file size before cover resize (covers stored as ~520px JPEG). */
const INKWELL_MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 ** 2

/** Longest edge for stored cover (JPEG); keeps shelf + localStorage reasonable. */
const MAX_DIM = 520
const JPEG_QUALITY = 0.88

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export async function fileToBookCoverDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file')
  }
  if (file.size > INKWELL_MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(`Image is too large (max ${formatBytes(INKWELL_MAX_IMAGE_UPLOAD_BYTES)} before processing)`)
  }
  const bmp = await createImageBitmap(file)
  try {
    const w = bmp.width
    const h = bmp.height
    const scale = Math.min(1, MAX_DIM / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read image')
    ctx.drawImage(bmp, 0, 0, tw, th)
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } finally {
    bmp.close()
  }
}
