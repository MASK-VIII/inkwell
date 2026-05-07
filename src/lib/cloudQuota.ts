/** Tier caps for cloud library backup (library zip size). Binary GiB (1024³). */

export const INKWELL_CLOUD_QUOTA_BASIC_BYTES = 2 * 1024 ** 3

export const INKWELL_CLOUD_QUOTA_PRO_BYTES = 20 * 1024 ** 3

/** Max source file size before cover resize (covers stored as ~520px JPEG). */
export const INKWELL_MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 ** 2

export const CLOUD_LIMIT_BASIC_DISPLAY = '2 GB'

export const CLOUD_LIMIT_PRO_DISPLAY = '20 GB'

export function formatCloudBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
