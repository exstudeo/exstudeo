/**
 * Persistent configuration store backed by IndexedDB.
 *
 * Each config domain (epub, ghgist, general) is stored as a separate document
 * keyed by domain name. On every read, stored values are merged over defaults
 * so that newly-added properties are automatically populated without migration.
 *
 * Reactive state (subscribe/getSnapshot) mirrors the pattern in {@link zenfs.ts}
 * for use with React's `useSyncExternalStore`.
 *
 * @module config-store
 */

import {
  type AppConfig,
  type ConfigDomain,
  DEFAULT_CONFIG,
} from "@/config"

const DB_NAME = "exstudeo-configs"
const DB_VERSION = 1
const STORE_NAME = "config"

// ── Internal IDB document shape ───────────────────────────────────────────

interface ConfigDocument<K extends ConfigDomain = ConfigDomain> {
  /** The config domain key, e.g. "epub", "ghgist", "general". */
  key: K
  /** The stored (partial) config values for this domain. */
  value: Partial<AppConfig[K]>
  /** Unix timestamp of the last update. */
  updatedAt: number
}

// ── Reactive state ────────────────────────────────────────────────────────

type Listener = () => void

const _listeners = new Set<Listener>()

/** Cached full config — rebuilt on every write. */
let _cachedConfig: AppConfig = { ...DEFAULT_CONFIG }

function notify() {
  for (const listener of _listeners) listener()
}

/**
 * Subscribe to config changes. Returns an unsubscribe function.
 * Mirrors the `zenfs.ts` reactive pattern.
 */
export function subscribe(fn: Listener): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/**
 * Get the current cached config snapshot.
 * Mirrors the `zenfs.ts` reactive pattern.
 */
export function getSnapshot(): AppConfig {
  return _cachedConfig
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Merge stored partial values over the defaults for a single domain.
 */
function mergeWithDefault<K extends ConfigDomain>(
  domain: K,
  stored: Partial<AppConfig[K]> | undefined,
): AppConfig[K] {
  return { ...DEFAULT_CONFIG[domain], ...stored } as AppConfig[K]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a single config domain, merging stored values over defaults.
 *
 * @example
 * ```ts
 * const epubCfg = await getConfig("epub")
 * console.log(epubCfg.zenFSPath) // "/epubs" (or user's override)
 * ```
 */
export async function getConfig<K extends ConfigDomain>(
  key: K,
): Promise<AppConfig[K]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => {
      const doc = request.result as ConfigDocument<K> | undefined
      resolve(mergeWithDefault(key, doc?.value))
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Read all config domains and return a fully merged {@link AppConfig}.
 */
export async function getAllConfigs(): Promise<AppConfig> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const docs = request.result as ConfigDocument[]
      const stored = docs.reduce(
        (acc, doc) => {
          acc[doc.key] = doc.value
          return acc
        },
        {} as Record<string, unknown>,
      )

      const merged: AppConfig = {
        explorer: mergeWithDefault("explorer", stored.explorer as Partial<AppConfig["explorer"]> | undefined)
        ,
        epub: mergeWithDefault("epub", stored.epub as Partial<AppConfig["epub"]> | undefined),
        ghgist: mergeWithDefault("ghgist", stored.ghgist as Partial<AppConfig["ghgist"]> | undefined),
        general: mergeWithDefault("general", stored.general as Partial<AppConfig["general"]> | undefined),
      }

      // Update cache
      _cachedConfig = merged

      resolve(merged)
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Persist a partial update to a single config domain.
 *
 * Merges the given partial values into the existing stored document for that
 * domain (or creates one if none exists). Other domains are untouched.
 *
 * After persisting, calls {@link getAllConfigs} to refresh the reactive cache
 * and notify subscribers.
 */
export async function setConfig<K extends ConfigDomain>(
  key: K,
  partial: Partial<AppConfig[K]>,
): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)

    const getRequest = store.get(key)
    getRequest.onsuccess = () => {
      const existing = getRequest.result as ConfigDocument<K> | undefined
      const doc: ConfigDocument<K> = {
        key,
        value: { ...existing?.value, ...partial },
        updatedAt: Date.now(),
      }
      store.put(doc)
    }

    tx.oncomplete = async () => {
      db.close()
      // Refresh cache and notify subscribers
      await getAllConfigs()
      notify()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Delete config for one or all domains.
 *
 * - If `key` is provided, only that domain is deleted.
 * - If omitted, ALL config documents are cleared.
 *
 * After deletion, {@link getAllConfigs} is called to refresh the reactive
 * cache (subsequent reads will return full defaults).
 */
export async function resetConfig(key?: ConfigDomain): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)

    if (key) {
      store.delete(key)
    } else {
      store.clear()
    }

    tx.oncomplete = async () => {
      db.close()
      // Refresh cache and notify subscribers
      await getAllConfigs()
      notify()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}