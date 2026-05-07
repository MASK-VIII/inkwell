import { exportLibraryZip, importInkwellArchive } from '../projectArchive'
import { clearCachedLibraryHead, writeCachedLibraryHead } from './libraryHeadCache'
import { getInkwellSupabaseClient } from './supabaseClient'
import type { InkwellSupabasePublicConfig } from './syncEnv'

const BUCKET = 'libraries'

export type LibraryHeadRow = {
  remote_rev: number | string | bigint
  storage_object_path: string
  updated_at?: string
}

function revToString(v: unknown): string {
  if (typeof v === 'bigint') return v.toString()
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v))
  if (typeof v === 'string' && v.length > 0) return v
  return '0'
}

function parseRpcResult(raw: unknown): { ok: boolean; remoteRev?: string; error?: string; serverRev?: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid server response' }
  const o = raw as Record<string, unknown>
  const ok = o.ok === true
  if (ok) {
    const rr = o.remote_rev
    let remoteRev: string | undefined
    if (typeof rr === 'number' || typeof rr === 'string' || typeof rr === 'bigint') remoteRev = revToString(rr)
    else if (rr && typeof rr === 'object' && 'toString' in rr) remoteRev = String((rr as { toString: () => string }).toString())
    return { ok: true, remoteRev }
  }
  const err = typeof o.error === 'string' ? o.error : 'unknown_error'
  if (err === 'conflict') {
    const sr = o.server_rev
    let serverRev: string | undefined
    if (typeof sr === 'number' || typeof sr === 'string' || typeof sr === 'bigint') serverRev = revToString(sr)
    else if (sr && typeof sr === 'object' && 'toString' in sr) serverRev = String((sr as { toString: () => string }).toString())
    return { ok: false, error: 'conflict', serverRev: serverRev ?? '0' }
  }
  return { ok: false, error: err }
}

export async function fetchRemoteLibraryHead(
  config: InkwellSupabasePublicConfig,
): Promise<{ ok: true; head: LibraryHeadRow | null } | { ok: false; error: string }> {
  const supabase = getInkwellSupabaseClient(config)
  const { data, error } = await supabase
    .from('library_heads')
    .select('remote_rev, storage_object_path, updated_at')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: true, head: null }
  const row = data as LibraryHeadRow
  if (!row.storage_object_path) return { ok: true, head: { ...row, storage_object_path: '' } }
  return { ok: true, head: row }
}

export type PullLibraryResult =
  | { ok: true; imported: number; remoteRev: string; noop?: boolean }
  | { ok: false; error: string }

/**
 * Download authoritative library zip from Storage when server revision is newer than `ifNewerThanRev`
 * (compare as bigint strings). Pass null to always pull when a storage path exists.
 */
export async function pullLibraryIfNewer(
  config: InkwellSupabasePublicConfig,
  options: { ifNewerThanRev: string | null },
): Promise<PullLibraryResult> {
  const headRes = await fetchRemoteLibraryHead(config)
  if (!headRes.ok) return headRes
  const head = headRes.head
  if (!head || !head.storage_object_path) {
    return { ok: true, imported: 0, remoteRev: '0', noop: true }
  }

  const serverRev = revToString(head.remote_rev)
  const localBound = options.ifNewerThanRev
  if (localBound != null && localBound !== '') {
    try {
      const a = BigInt(serverRev)
      const b = BigInt(localBound)
      if (a <= b) return { ok: true, imported: 0, remoteRev: serverRev, noop: true }
    } catch {
      if (serverRev === localBound) return { ok: true, imported: 0, remoteRev: serverRev, noop: true }
    }
  }

  const supabase = getInkwellSupabaseClient(config)
  const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(head.storage_object_path)
  if (dlErr || !fileData) return { ok: false, error: dlErr?.message ?? 'Download failed' }

  const blob = fileData
  const file = new File([blob], 'library.zip', { type: 'application/zip' })
  const res = await importInkwellArchive(file)
  if (!res.ok) return { ok: false, error: res.error }
  if (res.mode !== 'library') return { ok: false, error: 'Cloud snapshot was not a library archive' }

  const updatedAt = typeof head.updated_at === 'string' ? head.updated_at : undefined
  await writeCachedLibraryHead({ remoteRev: serverRev, updatedAt, lastSyncedAt: Date.now() })

  return { ok: true, imported: res.imported, remoteRev: serverRev }
}

export type PushLibraryZipOptions = {
  /** When set, refuse upload if zip exceeds this size (tier cloud quota). */
  maxLibraryBytes?: number
}

export type PushLibraryResult =
  | { ok: true; remoteRev: string }
  | { ok: false; error: string }
  | { ok: false; conflict: true; serverRev: string }
  | { ok: false; error: 'cloud_quota_exceeded'; bytesUsed: number; bytesLimit: number }

export async function pushLibraryZip(
  config: InkwellSupabasePublicConfig,
  options?: PushLibraryZipOptions,
): Promise<PushLibraryResult> {
  const supabase = getInkwellSupabaseClient(config)
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return { ok: false, error: 'Not signed in' }
  const uid = userData.user.id

  const beforeHead = await fetchRemoteLibraryHead(config)
  if (!beforeHead.ok) return { ok: false, error: beforeHead.error }
  const baseRevStr = beforeHead.head ? revToString(beforeHead.head.remote_rev) : '0'
  const previousPath =
    beforeHead.head && beforeHead.head.storage_object_path ? String(beforeHead.head.storage_object_path) : ''

  const blob = await exportLibraryZip()
  const maxBytes = options?.maxLibraryBytes
  if (typeof maxBytes === 'number' && maxBytes > 0 && blob.size > maxBytes) {
    return { ok: false, error: 'cloud_quota_exceeded', bytesUsed: blob.size, bytesLimit: maxBytes }
  }

  const stamp = `${Date.now()}_${typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : 'x'}`
  const objectPath = `${uid}/library-${stamp}.zip`

  const up = await supabase.storage.from(BUCKET).upload(objectPath, blob, {
    contentType: 'application/zip',
    upsert: true,
  })
  if (up.error) return { ok: false, error: up.error.message }

  const pBase = baseRevStr === '' ? 0 : Number.parseInt(baseRevStr, 10)
  const pBaseSafe = Number.isFinite(pBase) ? pBase : 0

  const { data: rpcData, error: rpcErr } = await supabase.rpc('inkwell_commit_library_push', {
    p_base_rev: pBaseSafe,
    p_storage_path: objectPath,
  })

  if (rpcErr) {
    void supabase.storage.from(BUCKET).remove([objectPath])
    return { ok: false, error: rpcErr.message }
  }

  const parsed = parseRpcResult(rpcData)
  if (parsed.ok && parsed.remoteRev) {
    const headRes = await fetchRemoteLibraryHead(config)
    const updatedAt = headRes.ok && headRes.head?.updated_at ? String(headRes.head.updated_at) : undefined
    await writeCachedLibraryHead({
      remoteRev: parsed.remoteRev,
      updatedAt,
      lastSyncedAt: Date.now(),
    })
    if (previousPath && previousPath !== objectPath) {
      void supabase.storage.from(BUCKET).remove([previousPath])
    }
    return { ok: true, remoteRev: parsed.remoteRev }
  }

  if (parsed.error === 'conflict' && parsed.serverRev != null) {
    void supabase.storage.from(BUCKET).remove([objectPath])
    return { ok: false, conflict: true, serverRev: parsed.serverRev }
  }

  void supabase.storage.from(BUCKET).remove([objectPath])
  return { ok: false, error: parsed.error ?? 'Commit failed' }
}

export async function forcePushLibraryZip(
  config: InkwellSupabasePublicConfig,
  options?: PushLibraryZipOptions,
): Promise<PushLibraryResult> {
  const supabase = getInkwellSupabaseClient(config)
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return { ok: false, error: 'Not signed in' }
  const uid = userData.user.id

  const beforeHead = await fetchRemoteLibraryHead(config)
  const previousPath =
    beforeHead.ok && beforeHead.head?.storage_object_path ? String(beforeHead.head.storage_object_path) : ''

  const blob = await exportLibraryZip()
  const maxBytes = options?.maxLibraryBytes
  if (typeof maxBytes === 'number' && maxBytes > 0 && blob.size > maxBytes) {
    return { ok: false, error: 'cloud_quota_exceeded', bytesUsed: blob.size, bytesLimit: maxBytes }
  }

  const stamp = `${Date.now()}_${typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : 'x'}`
  const objectPath = `${uid}/library-force-${stamp}.zip`

  const up = await supabase.storage.from(BUCKET).upload(objectPath, blob, {
    contentType: 'application/zip',
    upsert: true,
  })
  if (up.error) return { ok: false, error: up.error.message }

  const { data: rpcData, error: rpcErr } = await supabase.rpc('inkwell_force_commit_library_push', {
    p_storage_path: objectPath,
  })

  if (rpcErr) {
    void supabase.storage.from(BUCKET).remove([objectPath])
    return { ok: false, error: rpcErr.message }
  }

  const parsed = parseRpcResult(rpcData)
  if (parsed.ok && parsed.remoteRev) {
    const headRes = await fetchRemoteLibraryHead(config)
    const updatedAt = headRes.ok && headRes.head?.updated_at ? String(headRes.head.updated_at) : undefined
    await writeCachedLibraryHead({
      remoteRev: parsed.remoteRev,
      updatedAt,
      lastSyncedAt: Date.now(),
    })
    if (previousPath && previousPath !== objectPath) {
      void supabase.storage.from(BUCKET).remove([previousPath])
    }
    return { ok: true, remoteRev: parsed.remoteRev }
  }

  void supabase.storage.from(BUCKET).remove([objectPath])
  return { ok: false, error: parsed.error ?? 'Force commit failed' }
}

export { clearCachedLibraryHead }
