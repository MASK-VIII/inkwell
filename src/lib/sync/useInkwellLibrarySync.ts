import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPersistentTwoWaySyncQueue, type SyncFlushContext } from '../cloudSync/syncQueue'
import { getSessionSnapshot, signOutInkwellCloud, subscribeAuthSession, updatePassword } from './authSession'
import { readCachedLibraryHead } from './libraryHeadCache'
import { exportLibraryZip } from '../projectArchive'
import { formatCloudBytes } from '../cloudQuota'
import { clearCachedLibraryHead, fetchRemoteLibraryHead, forcePushLibraryZip, pullLibraryIfNewer, pushLibraryZip } from './syncEngine'
import { getInkwellSupabaseClient } from './supabaseClient'
import type { InkwellSupabasePublicConfig } from './syncEnv'

export type LibrarySyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'conflict'

export type LibrarySyncConflict = {
  serverRev: string
}

function friendlyCloudSyncError(message: string): string {
  if (message === 'sync_not_entitled' || message === 'pro_required') {
    return 'Inkwell Basic or Pro is required for cloud library sync.'
  }
  if (message === 'cloud_quota_exceeded') {
    return (
      'Cloud backup limit reached. Your library still works locally. Remove large images or upgrade to raise the limit, then sync again.'
    )
  }
  return message
}

function cloudQuotaExceededToast(bytesUsed: number, bytesLimit: number): string {
  return `Cloud backup limit reached (${formatCloudBytes(bytesUsed)} / ${formatCloudBytes(bytesLimit)}). Local writing is unchanged. Remove images or upgrade, then sync again.`
}

type SyncOptions = {
  supabaseConfig: InkwellSupabasePublicConfig | null
  showToast: (message: string) => void
  reloadApp: () => void
  /** When false, library push/pull is skipped (Inkwell Pro only). */
  canUseCloudSync?: boolean
  /** Basic / Pro zip cap; set whenever `canUseCloudSync` is true. */
  cloudLibraryQuotaBytes?: number | null
}

export function useInkwellLibrarySync(options: SyncOptions) {
  const optsRef = useRef(options)

  useEffect(() => {
    optsRef.current = options
  }, [options])

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [needsPasswordRecovery, setNeedsPasswordRecovery] = useState(false)
  const [status, setStatus] = useState<LibrarySyncStatus>('idle')
  const [statusDetail, setStatusDetail] = useState('')
  const [conflict, setConflict] = useState<LibrarySyncConflict | null>(null)
  /** True when the durable sync queue has one or more operations (IndexedDB). */
  const [queueHasWork, setQueueHasWork] = useState(false)
  /** True until user resolves a push conflict (keep local / use cloud). */
  const unresolvedConflictRef = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialPullKeyRef = useRef<string | null>(null)

  const syncQueue = useMemo(
    () =>
      createPersistentTwoWaySyncQueue(
        async (op) => {
          const { supabaseConfig: cfg, showToast, reloadApp } = optsRef.current
          if (!cfg) return { ok: false, error: 'Sync not configured' }
          if (op.kind === 'push_project') return { ok: true }

          const firstTry = op.attempts === 0

          try {
            if (op.kind === 'pull_library' || op.kind === 'push_library') {
              if (!optsRef.current.canUseCloudSync) {
                if (firstTry) {
                  optsRef.current.showToast('Cloud library sync requires Inkwell Basic or Pro.')
                }
                return { ok: false, error: 'sync_not_entitled' }
              }
            }

            if (op.kind === 'pull_library') {
              const cached = await readCachedLibraryHead()
              const bound = cached?.remoteRev ?? null
              const r = await pullLibraryIfNewer(cfg, { ifNewerThanRev: bound })
              if (!r.ok) {
                if (firstTry) showToast(`Cloud pull failed: ${friendlyCloudSyncError(r.error)}`)
                return { ok: false, error: r.error }
              }
              if (r.noop) return { ok: true }
              showToast(`Cloud library downloaded (${r.imported} projects)`)
              reloadApp()
              return { ok: true }
            }

            if (op.kind === 'push_library') {
              const quota = optsRef.current.cloudLibraryQuotaBytes
              const pushOpts =
                typeof quota === 'number' && quota > 0 ? { maxLibraryBytes: quota } : undefined
              const r = await pushLibraryZip(cfg, pushOpts)
              if (r.ok) return { ok: true }
              if ('conflict' in r && r.conflict) return { ok: 'conflict', serverRev: r.serverRev }
              if (
                !r.ok &&
                'error' in r &&
                r.error === 'cloud_quota_exceeded' &&
                'bytesUsed' in r &&
                'bytesLimit' in r
              ) {
                if (firstTry) showToast(cloudQuotaExceededToast(r.bytesUsed, r.bytesLimit))
                return { ok: false, error: 'cloud_quota_exceeded' }
              }
              const err = 'error' in r ? r.error : 'Push failed'
              if (firstTry) showToast(`Cloud push failed: ${friendlyCloudSyncError(typeof err === 'string' ? err : 'Push failed')}`)
              return { ok: false, error: typeof err === 'string' ? err : 'Push failed' }
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Sync failed'
            if (firstTry) showToast(`Cloud sync failed: ${msg}`)
            return { ok: false, error: msg }
          }

          return { ok: true }
        },
        {
          onPushConflict: (serverRev) => {
            unresolvedConflictRef.current = true
            setConflict({ serverRev })
            setStatus('conflict')
            setStatusDetail('Library changed elsewhere since your last sync')
          },
        },
      ),
    [],
  )

  const refreshQueuePending = useCallback(async () => {
    const ops = await syncQueue.snapshot()
    setQueueHasWork(ops.length > 0)
  }, [syncQueue])

  /** Chromium/Electron often report `navigator.onLine === false` while HTTPS to Supabase still works. */
  const shouldAttemptNetworkSync = useCallback(() => {
    if (typeof navigator === 'undefined') return true
    if (navigator.onLine) return true
    if (typeof window !== 'undefined' && window.inkwellDesktop) return true
    return false
  }, [])

  const flushQueue = useCallback(async () => {
    const ctx: SyncFlushContext = { now: Date.now(), online: shouldAttemptNetworkSync() }
    if (!ctx.online) {
      setStatus('offline')
      setStatusDetail('Offline — sync when you reconnect')
      await refreshQueuePending()
      return
    }
    if (!optsRef.current.supabaseConfig) {
      await refreshQueuePending()
      return
    }
    if (!unresolvedConflictRef.current) {
      setStatus('syncing')
      setStatusDetail('Syncing…')
    }
    try {
      await syncQueue.flush(ctx)
      if (unresolvedConflictRef.current) {
        setStatus('conflict')
        setStatusDetail('Library changed elsewhere since your last sync')
      } else {
        setStatus('idle')
        setStatusDetail('')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync error'
      if (!unresolvedConflictRef.current) {
        setStatus('error')
        setStatusDetail(msg)
      }
      optsRef.current.showToast(msg)
    } finally {
      await refreshQueuePending()
    }
  }, [shouldAttemptNetworkSync, syncQueue, refreshQueuePending])

  const scheduleIdleFlush = useCallback(() => {
    if (!optsRef.current.supabaseConfig || !userEmail || unresolvedConflictRef.current) return
    if (!optsRef.current.canUseCloudSync) return
    if (idleTimerRef.current != null) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null
      void (async () => {
        await syncQueue.enqueue('push_library')
        await flushQueue()
      })()
    }, 3500)
  }, [flushQueue, userEmail, syncQueue])

  useEffect(() => {
    const cfg = options.supabaseConfig
    if (!cfg) {
      queueMicrotask(() => setUserEmail(null))
      return
    }
    let cancelled = false
    void getSessionSnapshot(cfg).then((s) => {
      if (cancelled) return
      queueMicrotask(() => {
        if (!cancelled) setUserEmail(s.user?.email ?? null)
      })
    })
    const unsub = subscribeAuthSession(cfg, (snap, event) => {
      queueMicrotask(() => {
        if (event === 'PASSWORD_RECOVERY') setNeedsPasswordRecovery(true)
        if (event === 'SIGNED_OUT') setNeedsPasswordRecovery(false)
        setUserEmail(snap.user?.email ?? null)
        if (!snap.user) {
          void clearCachedLibraryHead()
          initialPullKeyRef.current = null
          unresolvedConflictRef.current = false
          setConflict(null)
          setQueueHasWork(false)
        }
      })
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [options.supabaseConfig])

  useEffect(() => {
    if (!options.supabaseConfig || !userEmail) return
    const onOnline = () => void flushQueue()
    const onVis = () => {
      if (document.visibilityState === 'visible') void flushQueue()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVis)
    const t = window.setInterval(() => void flushQueue(), 90_000)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(t)
    }
  }, [options.supabaseConfig, userEmail, flushQueue])

  useEffect(() => {
    if (!options.supabaseConfig || !userEmail) return
    queueMicrotask(() => void refreshQueuePending())
  }, [options.supabaseConfig, userEmail, refreshQueuePending])

  useEffect(() => {
    const cfg = options.supabaseConfig
    if (!cfg || !userEmail || !options.canUseCloudSync) return
    const key = `${userEmail}\0${options.canUseCloudSync ? '1' : '0'}`
    if (initialPullKeyRef.current === key) return
    initialPullKeyRef.current = key
    void (async () => {
      await syncQueue.enqueue('pull_library')
      await flushQueue()
    })()
  }, [options.supabaseConfig, options.canUseCloudSync, userEmail, flushQueue, syncQueue])

  const syncNow = useCallback(() => {
    const { supabaseConfig, showToast } = optsRef.current
    if (!supabaseConfig) {
      showToast('Cloud sync is not enabled in this build (missing Vite env).')
      return
    }
    if (!userEmail) {
      showToast('Sign in to the cloud first (open sign-in from the bookshelf banner or Account).')
      return
    }
    if (!optsRef.current.canUseCloudSync) {
      showToast('Cloud library sync requires Inkwell Basic or Pro.')
      return
    }
    if (!shouldAttemptNetworkSync()) {
      showToast('You appear offline — reconnect, then try Sync again.')
      setStatus('offline')
      setStatusDetail('Offline — sync when you reconnect')
      return
    }
    void (async () => {
      try {
        await syncQueue.enqueue('pull_library')
        await syncQueue.enqueue('push_library')
        await flushQueue()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Sync error'
        showToast(msg)
      }
    })()
  }, [flushQueue, syncQueue, userEmail, shouldAttemptNetworkSync])

  const notifyLocalSaved = useCallback(() => {
    if (!optsRef.current.supabaseConfig || !userEmail || unresolvedConflictRef.current) return
    if (!optsRef.current.canUseCloudSync) return
    void syncQueue.enqueue('push_library').then(() => void refreshQueuePending())
    scheduleIdleFlush()
  }, [userEmail, scheduleIdleFlush, syncQueue, refreshQueuePending])

  const resolveKeepLocal = useCallback(async () => {
    const cfg = optsRef.current.supabaseConfig
    if (!cfg || !conflict) return
    setStatus('syncing')
    setStatusDetail('Uploading…')
    try {
      const quota = optsRef.current.cloudLibraryQuotaBytes
      const pushOpts =
        typeof quota === 'number' && quota > 0 ? { maxLibraryBytes: quota } : undefined
      const r = await forcePushLibraryZip(cfg, pushOpts)
      if (!r.ok) {
        if (
          'error' in r &&
          r.error === 'cloud_quota_exceeded' &&
          'bytesUsed' in r &&
          'bytesLimit' in r
        ) {
          optsRef.current.showToast(cloudQuotaExceededToast(r.bytesUsed, r.bytesLimit))
        } else {
          optsRef.current.showToast(
            friendlyCloudSyncError('error' in r ? String(r.error) : 'Could not update cloud'),
          )
        }
        setStatus('error')
        return
      }
      unresolvedConflictRef.current = false
      setConflict(null)
      setStatus('idle')
      setStatusDetail('')
      optsRef.current.showToast('Cloud updated with this device’s library')
    } catch (e) {
      optsRef.current.showToast(e instanceof Error ? e.message : 'Force push failed')
      setStatus('error')
    }
  }, [conflict])

  const resolveUseCloud = useCallback(async () => {
    const cfg = optsRef.current.supabaseConfig
    if (!cfg || !conflict) return
    setStatus('syncing')
    setStatusDetail('Downloading…')
    try {
      const r = await pullLibraryIfNewer(cfg, { ifNewerThanRev: null })
      if (!r.ok) {
        optsRef.current.showToast(friendlyCloudSyncError(r.error))
        setStatus('error')
        return
      }
      if (r.noop) {
        optsRef.current.showToast('Already up to date with cloud')
      } else {
        optsRef.current.showToast(`Replaced local library (${r.imported} projects)`)
      }
      unresolvedConflictRef.current = false
      setConflict(null)
      setStatus('idle')
      setStatusDetail('')
      if (!r.noop) optsRef.current.reloadApp()
    } catch (e) {
      optsRef.current.showToast(e instanceof Error ? e.message : 'Download failed')
      setStatus('error')
    }
  }, [conflict])

  const exportBothZips = useCallback(async () => {
    const cfg = optsRef.current.supabaseConfig
    if (!cfg || !conflict) return
    try {
      const localBlob = await exportLibraryZip()
      const supabase = getInkwellSupabaseClient(cfg)
      const head = await fetchRemoteLibraryHead(cfg)
      if (!head.ok || !head.head?.storage_object_path) {
        optsRef.current.showToast('Could not read cloud path')
        return
      }
      const { data: fileData, error } = await supabase.storage.from('libraries').download(head.head.storage_object_path)
      if (error || !fileData) {
        optsRef.current.showToast(error?.message ?? 'Cloud download failed')
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(localBlob)
      a.download = 'inkwell-local-conflict.zip'
      a.click()
      URL.revokeObjectURL(a.href)
      const b = document.createElement('a')
      b.href = URL.createObjectURL(fileData)
      b.download = 'inkwell-cloud-conflict.zip'
      b.click()
      URL.revokeObjectURL(b.href)
      optsRef.current.showToast('Saved both zip files')
    } catch (e) {
      optsRef.current.showToast(e instanceof Error ? e.message : 'Export failed')
    }
  }, [conflict])

  const signOutCloudOnly = useCallback(async () => {
    const cfg = optsRef.current.supabaseConfig
    if (!cfg) return
    await signOutInkwellCloud(cfg)
    unresolvedConflictRef.current = false
    setConflict(null)
    setUserEmail(null)
    setNeedsPasswordRecovery(false)
    setStatus('idle')
    setStatusDetail('')
  }, [])

  const completePasswordRecovery = useCallback(async (newPassword: string) => {
    const cfg = optsRef.current.supabaseConfig
    if (!cfg) return { ok: false as const, error: 'Cloud sync is not configured' }
    const r = await updatePassword(cfg, newPassword)
    if (r.ok) setNeedsPasswordRecovery(false)
    return r
  }, [])

  const snapshot = useCallback(() => syncQueue.snapshot(), [syncQueue])

  return useMemo(
    () => ({
      userEmail,
      needsPasswordRecovery,
      status,
      statusDetail,
      conflict,
      queueHasWork,
      syncNow,
      notifyLocalSaved,
      resolveKeepLocal,
      resolveUseCloud,
      exportBothZips,
      signOutCloudOnly,
      completePasswordRecovery,
      flushQueue,
      snapshot,
    }),
    [
      userEmail,
      needsPasswordRecovery,
      status,
      statusDetail,
      conflict,
      queueHasWork,
      syncNow,
      notifyLocalSaved,
      resolveKeepLocal,
      resolveUseCloud,
      exportBothZips,
      signOutCloudOnly,
      completePasswordRecovery,
      flushQueue,
      snapshot,
    ],
  )
}
