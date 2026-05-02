const DB_NAME = 'inkwell-projects'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB unavailable'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
      req.onsuccess = () => resolve(req.result)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
    })
  }
  return dbPromise
}

export async function idbGet(key: string): Promise<string | undefined> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const r = tx.objectStore(STORE).get(key)
      r.onerror = () => reject(r.error)
      r.onsuccess = () => resolve(r.result as string | undefined)
    })
  } catch {
    return undefined
  }
}

export async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(value, key)
  })
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE).delete(key)
    })
  } catch {
    /* ignore */
  }
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
