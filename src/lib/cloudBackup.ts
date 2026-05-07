import { exportLibraryZip } from './projectArchive'

const DEVICE_STORAGE_KEY = 'inkwell-cloud-device-id-v1'

export type CloudBackupConfig = {
  url: string
  /** Optional shared secret for private backup receivers (Bearer). */
  apiKey?: string
}

function isLegacyCloudBackupExplicitlyEnabled(): boolean {
  const raw = (import.meta.env.VITE_ENABLE_LEGACY_BACKUP ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function getCloudBackupConfig(): CloudBackupConfig | null {
  // Legacy backup POST uses a shared secret that cannot be protected in public web bundles.
  // Keep the capability for private/internal builds only.
  if (import.meta.env.PROD && !isLegacyCloudBackupExplicitlyEnabled()) return null

  const url = (import.meta.env.VITE_INKWELL_CLOUD_BACKUP_URL ?? '').trim()
  if (!url) return null
  const key = (import.meta.env.VITE_INKWELL_CLOUD_BACKUP_KEY ?? '').trim()
  return { url, apiKey: key || undefined }
}

export function isCloudBackupConfigured(): boolean {
  return getCloudBackupConfig() != null
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (existing && /^[\w-]{8,128}$/.test(existing)) return existing
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_STORAGE_KEY, id)
    return id
  } catch {
    return 'unknown-device'
  }
}

/**
 * POST full library zip to a configured HTTPS endpoint (phase 1: read-only cloud backup).
 * Expects multipart field `archive` plus optional metadata fields.
 */
export async function postLibraryBackupZip(
  blob: Blob,
  config: CloudBackupConfig,
): Promise<{ ok: true; status: number } | { ok: false; error: string }> {
  const form = new FormData()
  form.append('archive', blob, 'inkwell-library-backup.zip')
  form.append('exportedAt', String(Date.now()))
  form.append('deviceId', getOrCreateDeviceId())

  const headers = new Headers()
  if (config.apiKey) headers.set('Authorization', `Bearer ${config.apiKey}`)

  try {
    const res = await fetch(config.url, { method: 'POST', body: form, headers })
    if (!res.ok) {
      const hint = res.status === 401 || res.status === 403 ? ' (check API key)' : ''
      return { ok: false, error: `Backup failed (${res.status})${hint}` }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: msg }
  }
}

export async function uploadFullLibraryCloudBackup(): Promise<
  { ok: true; status: number } | { ok: false; error: string }
> {
  const config = getCloudBackupConfig()
  if (!config) return { ok: false, error: 'Cloud backup is not configured' }
  const blob = await exportLibraryZip()
  return postLibraryBackupZip(blob, config)
}
