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
  /** Whether this entry should be currently mounted in ZenFS. */
  shouldBeMounted: boolean
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


// 
// Internal helpers
// 

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
      resolve(raw)
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
    const toSave = { ...entry }
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



/**
 * Alerts the user and requests persistent storage permission if not already granted.
 * @returns {Promise<boolean>} Resolves to true if storage is successfully persisted, false otherwise.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  // 1. Check if the StorageManager and required methods are supported
  if (!navigator.storage || !navigator.storage.persist || !navigator.storage.persisted) {
    console.warn("Storage Persistence API is not supported in this browser.");
    return false;
  }

  try {
    // 2. Skip if persistence is already granted
    const alreadyPersisted = await navigator.storage.persisted();
    if (alreadyPersisted) {
      console.log("Storage is already persistent. Skipping request.");
      return true;
    }

    // 3. Alert the user before requesting privilege
    alert(
      "This application will now request persistent storage to prevent your data from being deleted by the browser."
    );

    // 4. Request persistence
    const isPersisted = await navigator.storage.persist();
    
    if (isPersisted) {
      console.log("Storage successfully marked as persistent.");
    } else {
      console.warn("Storage persistence request was denied by the browser.");
    }
    
    return isPersisted;
  } catch (error) {
    console.error("An error occurred while handling storage persistence:", error);
    return false;
  }
}