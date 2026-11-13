/**
 * Persistencia local con IndexedDB. Si no está disponible (p. ej. modo privado
 * antiguo) cae a localStorage y, en último caso, a memoria.
 */
const DB_NAME = 'forma-db'
const STORES = ['routines', 'sessions', 'kv', 'body', 'wellness', 'activities'] as const
type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase | null> | null = null
const memory: Record<string, Map<string, unknown>> = Object.fromEntries(STORES.map((s) => [s, new Map()]))

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 2)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

const lsKey = (store: StoreName, key: string) => `forma:${store}:${key}`

function tx<T>(db: IDBDatabase, store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const r = fn(t.objectStore(store))
    t.oncomplete = () => resolve(r.result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export async function dbPut<T>(store: StoreName, key: string, value: T): Promise<void> {
  const db = await open()
  if (db) {
    try {
      await tx(db, store, 'readwrite', (s) => s.put(value, key))
      return
    } catch {
      /* fallthrough */
    }
  }
  memory[store].set(key, value)
  try {
    localStorage.setItem(lsKey(store, key), JSON.stringify(value))
  } catch {
    /* sin espacio */
  }
}

export async function dbDelete(store: StoreName, key: string): Promise<void> {
  const db = await open()
  if (db) {
    try {
      await tx(db, store, 'readwrite', (s) => s.delete(key))
      return
    } catch {
      /* fallthrough */
    }
  }
  memory[store].delete(key)
  try {
    localStorage.removeItem(lsKey(store, key))
  } catch {
    /* noop */
  }
}

export async function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open()
  if (db) {
    try {
      return (await tx(db, store, 'readonly', (s) => s.get(key))) as T | undefined
    } catch {
      /* fallthrough */
    }
  }
  if (memory[store].has(key)) return memory[store].get(key) as T
  try {
    const raw = localStorage.getItem(lsKey(store, key))
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export async function dbAll<T>(store: StoreName): Promise<T[]> {
  const db = await open()
  if (db) {
    try {
      return (await tx(db, store, 'readonly', (s) => s.getAll())) as T[]
    } catch {
      /* fallthrough */
    }
  }
  const out: T[] = [...(memory[store].values() as Iterable<T>)]
  if (!out.length) {
    try {
      const prefix = `forma:${store}:`
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(prefix)) out.push(JSON.parse(localStorage.getItem(k)!) as T)
      }
    } catch {
      /* noop */
    }
  }
  return out
}

export type { StoreName }

export async function dbClearAll(): Promise<void> {
  for (const s of STORES) {
    const db = await open()
    if (db) {
      try {
        await tx(db, s, 'readwrite', (st) => st.clear())
      } catch {
        /* noop */
      }
    }
    memory[s].clear()
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('forma:'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* noop */
  }
}

export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    /* noop */
  }
}
