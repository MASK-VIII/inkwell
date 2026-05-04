import { idbGet, idbSet } from '../storage/projectIdb'
import type { SyncQueueOperation } from './types'

const QUEUE_IDB_KEY = 'inkwell-cloud-sync-queue-v1'
const MAX_ATTEMPTS = 10
const BASE_BACKOFF_MS = 1200
const MAX_BACKOFF_MS = 120_000

function parseQueue(raw: string | undefined): SyncQueueOperation[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter(isValidOp)
  } catch {
    return []
  }
}

function isValidOp(o: unknown): o is SyncQueueOperation {
  if (!o || typeof o !== 'object') return false
  const r = o as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    (r.kind === 'push_library' || r.kind === 'pull_library' || r.kind === 'push_project') &&
    typeof r.createdAt === 'number' &&
    typeof r.attempts === 'number'
  )
}

async function loadQueue(): Promise<SyncQueueOperation[]> {
  const raw = await idbGet(QUEUE_IDB_KEY)
  return parseQueue(raw)
}

async function saveQueue(ops: SyncQueueOperation[]): Promise<void> {
  await idbSet(QUEUE_IDB_KEY, JSON.stringify(ops))
}

function backoffMs(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1))
  const jitter = Math.floor(Math.random() * 400)
  return exp + jitter
}

function dedupeEnqueue(prev: SyncQueueOperation[], kind: SyncQueueOperation['kind'], projectId?: string): SyncQueueOperation[] {
  let next = prev
  if (kind === 'push_library' || kind === 'pull_library') {
    next = prev.filter((o) => o.kind !== kind)
  } else if (kind === 'push_project' && projectId) {
    next = prev.filter((o) => !(o.kind === 'push_project' && o.projectId === projectId))
  }
  return next
}

export type SyncFlushContext = {
  now: number
  online: boolean
}

export type TwoWaySyncQueue = {
  /** Resolves after the op is persisted to the durable queue (serialize with `flush`). */
  enqueue: (kind: SyncQueueOperation['kind'], projectId?: string) => Promise<void>
  flush: (ctx: SyncFlushContext) => Promise<void>
  snapshot: () => Promise<SyncQueueOperation[]>
  /** Process one ready entry if any; used by tests or manual drain. */
  drainOne: (ctx: SyncFlushContext) => Promise<boolean>
}

export type QueueProcessorResult =
  | { ok: true }
  | { ok: false; error: string }
  /** Stop flush; do not requeue (push conflict — user must resolve in UI). */
  | { ok: 'conflict'; serverRev: string }

export type QueueProcessor = (op: SyncQueueOperation) => Promise<QueueProcessorResult>

/**
 * Durable FIFO-ish queue in IndexedDB; `processor` performs network work (pull/push).
 */
export type PersistentQueueOptions = {
  onPushConflict?: (serverRev: string) => void
}

export function createPersistentTwoWaySyncQueue(
  processor: QueueProcessor,
  options?: PersistentQueueOptions,
): TwoWaySyncQueue {
  let flushLock: Promise<void> = Promise.resolve()
  let enqueueChain: Promise<void> = Promise.resolve()

  const runFlush = async (ctx: SyncFlushContext): Promise<void> => {
    await enqueueChain
    if (!ctx.online) return
    const ops = await loadQueue()
    const now = ctx.now

    while (ops.length > 0) {
      const idx = ops.findIndex((o) => (o.nextAttemptAt ?? 0) <= now)
      if (idx === -1) break

      const [op] = ops.splice(idx, 1)
      const res = await processor(op)

      if (res.ok === true) {
        await saveQueue(ops)
        continue
      }

      if (res.ok === 'conflict') {
        await saveQueue(ops)
        options?.onPushConflict?.(res.serverRev)
        break
      }

      const attempts = op.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        const failed: SyncQueueOperation = {
          ...op,
          attempts,
          lastError: res.error,
          nextAttemptAt: now + MAX_BACKOFF_MS * 24,
        }
        ops.push(failed)
        await saveQueue(ops)
        break
      }

      const nextAttemptAt = now + backoffMs(attempts)
      const requeue: SyncQueueOperation = {
        ...op,
        attempts,
        lastError: res.error,
        nextAttemptAt,
      }
      ops.splice(idx, 0, requeue)
      await saveQueue(ops)
      break
    }
  }

  return {
    enqueue(kind, projectId) {
      enqueueChain = enqueueChain.then(async () => {
        const prev = await loadQueue()
        const trimmed = dedupeEnqueue(prev, kind, projectId)
        const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `q_${Date.now()}`
        const next: SyncQueueOperation[] = [
          ...trimmed,
          {
            id,
            kind,
            projectId,
            createdAt: Date.now(),
            attempts: 0,
            nextAttemptAt: 0,
          },
        ]
        await saveQueue(next)
      })
      return enqueueChain
    },
    async flush(ctx) {
      flushLock = flushLock.then(() => runFlush(ctx))
      await flushLock
    },
    async snapshot() {
      return loadQueue()
    },
    async drainOne(ctx) {
      await enqueueChain
      if (!ctx.online) return false
      const ops = await loadQueue()
      const now = ctx.now
      const idx = ops.findIndex((o) => (o.nextAttemptAt ?? 0) <= now)
      if (idx === -1) return false
      const [op] = ops.splice(idx, 1)
      const res = await processor(op)
      if (res.ok === true) {
        await saveQueue(ops)
        return true
      }
      if (res.ok === 'conflict') {
        options?.onPushConflict?.(res.serverRev)
        ops.splice(idx, 0, op)
        await saveQueue(ops)
        return false
      }
      const attempts = op.attempts + 1
      const requeue: SyncQueueOperation = {
        ...op,
        attempts,
        lastError: res.error,
        nextAttemptAt: now + backoffMs(attempts),
      }
      ops.splice(idx, 0, requeue)
      await saveQueue(ops)
      return false
    },
  }
}

/** @deprecated use createPersistentTwoWaySyncQueue */
export function createTwoWaySyncQueue(): TwoWaySyncQueue {
  const pending: SyncQueueOperation[] = []
  return {
    enqueue(kind, projectId) {
      const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `q_${Date.now()}`
      pending.push({
        id,
        kind,
        projectId,
        createdAt: Date.now(),
        attempts: 0,
      })
      return Promise.resolve()
    },
    async flush(_ctx: SyncFlushContext) {
      void _ctx
    },
    async snapshot() {
      return [...pending]
    },
    async drainOne(_ctx: SyncFlushContext) {
      void _ctx
      return false
    },
  }
}
