/**
 * Persistent storage for directory mount entries using IndexedDB.
 *
 * Each mount entry stores a {@link BackendConfig} which describes the ZenFS
 * backend type and its configuration (e.g., FSA directory handle or IndexedDB
 * store name).  The legacy `handle` field is preserved for backward compat.
 *
 * @module mount-store
 */

const DB_NAME = "exstudeo-mounts"
const DB_VERSION = 1
const STORE_NAME = "mounts"

// ── Backend config types ──────────────────────────────────────────────────

/** Configuration for a File System Access API backend. */
export interface FsaConfig {
  kind: "fsa"
  /** The directory handle for the mounted directory. */
  handle: FileSystemDirectoryHandle
}

/** Configuration for an IndexedDB backend. */
export interface IndexedDBConfig {
  kind: "indexeddb"
  /**
   * Name of the IndexedDB database.
   * Defaults to auto-derived from `mountPath` if not provided.
   */
  storeName?: string
}

/**
 * Discriminated union of all supported ZenFS backend configurations.
 *
 * To add a new backend, add a new variant here and a corresponding
 * case in {@link resolveBackendConfig} (in `lib/backend-resolver.ts`).
 */
export type BackendConfig = FsaConfig | IndexedDBConfig

// ── Mount entry ───────────────────────────────────────────────────────────

/**
 * A persisted ZenFS mount entry.
 */
export interface MountEntry {
  /** Unique identifier (crypto.randomUUID()). */
  id: string
  /** User-given label, e.g. "My Notes". */
  name: string
  /** Virtual mount path in ZenFS, e.g. "/notes". Must be unique across entries. */
  mountPath: string
  /**
   * Backend configuration — describes which backend type and how to configure it.
   * Required for all new entries.
   */
  backend: BackendConfig
  /** Whether this entry is currently mounted in ZenFS. */
  mounted: boolean
  /**
   * The FSA directory handle — storable in IndexedDB via structured cloning.
   * @deprecated Use `backend.kind === 'fsa' && backend.handle` instead.
   *   Kept for backward compatibility with entries persisted before
   *   multi-backend support.  Set alongside `backend` on new FSA entries
   *   so old code can still read it.
   */
  handle?: FileSystemDirectoryHandle
}

/**
 * Validate a mount path — must start with `/`, contain only valid path
 * characters, and not be the root `/`.
 */
export function isValidMountPath(path: string): boolean {
  return /^\/[a-zA-Z0-9_\-./]+$/.test(path) && path !== "/"
}

/**
 * Normalise a mount path — ensure it starts with `/` and has no trailing `/`.
 */
export function normaliseMountPath(path: string): string {
  let p = path.trim()
  if (!p.startsWith("/")) p = "/" + p
  p = p.replace(/\/+$/, "")
  return p || "/epubs"
}

// ---------------------------------------------------------------------------
// Normalization (backward compat)
// ---------------------------------------------------------------------------

/**
 * Synthesize a `backend` field for legacy entries that have `handle` but
 * no `backend`.  New entries always have `backend` set; this ensures old
 * persisted data works seamlessly.
 */
export function normalizeMountEntry(entry: MountEntry): MountEntry {
  // If backend is missing but handle exists, synthesize FSA config
  if (!entry.backend && entry.handle) {
    return {
      ...entry,
      backend: { kind: "fsa", handle: entry.handle },
    }
  }
  return entry
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
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Load all mount entries from IndexedDB.
 */
export async function loadMounts(): Promise<MountEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const raw = request.result as MountEntry[]
      // Normalize legacy entries (handle but no backend → synthesize FSA config)
      resolve(raw.map(normalizeMountEntry))
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Save a new mount entry to IndexedDB.
 *
 * For FSA entries, the legacy `handle` field is also written for backward
 * compatibility with any code still reading it directly.
 */
export async function saveMount(entry: MountEntry): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    // Ensure backward compat: set handle on FSA entries
    const toSave = { ...entry }
    if (entry.backend.kind === "fsa" && !toSave.handle) {
      toSave.handle = entry.backend.handle
    }
    const request = store.put(toSave)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Update specific fields of an existing mount entry.
 *
 * If the update changes the backend on an FSA entry, the legacy `handle`
 * field is synced to match `backend.handle`.
 */
export async function updateMount(
  id: string,
  partial: Partial<MountEntry>,
): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const existing = getRequest.result as MountEntry | undefined
      if (!existing) {
        reject(new Error(`Mount entry "${id}" not found`))
        return
      }
      const updated = { ...existing, ...partial }
      // Keep legacy handle in sync for FSA entries
      if (updated.backend?.kind === "fsa") {
        updated.handle = updated.backend.handle
      }
      store.put(updated)
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Permanently delete a mount entry from IndexedDB.
 */
export async function deleteMount(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

/**
 * Request read-write permission for a directory handle.
 *
 * Returns `true` if granted, `false` if denied.
 */
export async function requestHandlePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  // On first call in a session the browser may prompt the user.
  const result = await handle.requestPermission({ mode: "readwrite" })
  return result === "granted"
}

/**
 * Verify that a handle still has read-write permission (no prompt).
 *
 * Returns `true` if already granted.
 */
export async function queryHandlePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const result = await handle.queryPermission({ mode: "readwrite" })
  return result === "granted"
}
