import { formatCloudBytes, INKWELL_MAX_IMAGE_UPLOAD_BYTES } from './cloudQuota'

/** Longest edge for stored cover (JPEG); keeps shelf + localStorage reasonable. */
const MAX_DIM = 520
const JPEG_QUALITY = 0.88

export async function fileToBookCoverDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file')
  }
  if (file.size > INKWELL_MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(`Image is too large (max ${formatCloudBytes(INKWELL_MAX_IMAGE_UPLOAD_BYTES)} before processing)`)
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
