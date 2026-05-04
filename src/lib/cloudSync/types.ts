/**
 * Types for phase B two-way sync. Phase A uses `cloudBackup.ts` only.
 */

export type SyncQueueOperationKind = 'push_library' | 'push_project' | 'pull_library'

export type SyncQueueOperation = {
  id: string
  kind: SyncQueueOperationKind
  /** Target project when kind is push_project. */
  projectId?: string
  createdAt: number
  attempts: number
  lastError?: string
  /** After this timestamp (ms) the entry may be retried. */
  nextAttemptAt?: number
}

export type RemoteLibraryHead = {
  /** Opaque server revision for If-Match / conflict detection (phase B). */
  remoteRev: string | null
  /** ISO timestamp of last successful server write. */
  updatedAt?: string
}
