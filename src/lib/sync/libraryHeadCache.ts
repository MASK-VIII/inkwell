import { idbDelete, idbGet, idbSet } from '../storage/projectIdb'
import type { RemoteLibraryHead } from '../cloudSync/types'

const KEY = 'inkwell-library-remote-head-cache-v1'

export type CachedLibraryHead = RemoteLibraryHead & {
  /** Last time we successfully synced with server (ms). */
  lastSyncedAt?: number
}

export async function readCachedLibraryHead(): Promise<CachedLibraryHead | null> {
  const raw = await idbGet(KEY)
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Partial<CachedLibraryHead>
    if (o && typeof o.remoteRev === 'string') {
      return {
        remoteRev: o.remoteRev,
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
        lastSyncedAt: typeof o.lastSyncedAt === 'number' ? o.lastSyncedAt : undefined,
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

export async function writeCachedLibraryHead(head: CachedLibraryHead): Promise<void> {
  await idbSet(KEY, JSON.stringify(head))
}

export async function clearCachedLibraryHead(): Promise<void> {
  await idbDelete(KEY)
}
