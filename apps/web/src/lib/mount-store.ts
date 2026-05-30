/**
 * Persistent storage for directory mount entries using IndexedDB.
 *
 * Each mount entry stores a {@link FileSystemDirectoryHandle} (which supports
 * structured cloning) along with metadata — allowing the user to persist
 * directory picks across sessions, toggle mounts on/off, and delete entries.
 *
 * @module mount-store
 */

const DB_NAME = "exstudeo-mounts"
const DB_VERSION = 1
const STORE_NAME = "mounts"

/**
 * A persisted mount entry backed by a File System Access API directory handle.
 */
export interface MountEntry {
  /** Unique identifier (crypto.randomUUID()). */
  id: string
  /** User-given label, e.g. "My Notes". */
  name: string
  /** Virtual mount path in ZenFS, e.g. "/notes". Must be unique across entries. */
  mountPath: string
  /** The FSA directory handle — storable in IndexedDB via structured cloning. */
  handle: FileSystemDirectoryHandle
  /** Whether this entry is currently mounted in ZenFS. */
  mounted: boolean
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
      resolve(request.result as MountEntry[])
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Save a new mount entry to IndexedDB.
 */
export async function saveMount(entry: MountEntry): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(entry)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Update specific fields of an existing mount entry.
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
