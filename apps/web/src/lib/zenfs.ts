/**
 * Global ZenFS singleton — exposes the virtual filesystem.
 *
 * The exported `promises` object provides a POSIX filesystem API backed by
 * the user's configured backends (File System Access, IndexedDB, etc.).
 *
 * Supports dynamic mount/unmount at runtime for any backend type.
 *
 * @module zenfs
 */

import {
  fs as zenfsFs,
  promises as zenfsPromises,
  mount as zenfsMount,
  umount as zenfsUmount,
} from "@zenfs/core"
import {
  requestHandlePermission,
  saveMount,
  deleteMount as deleteMountFromStore,
  updateMount,
  type MountEntry,
} from "@/lib/mount-store"
import {
  resolveBackendConfig,
} from "@/lib/backend-resolver"

// ── Reactive state ────────────────────────────────────────────────────────

type Listener = () => void

/** All mount entries, including unmounted ones. */
let _mountEntries: MountEntry[] = []
/** entryId → reason string for entries that failed to mount. */
let _deniedEntries = new Map<string, string>()
const _listeners = new Set<Listener>()

/** Cached snapshot for useSyncExternalStore — updated only on change. */
let _snapshot: {
  entries: MountEntry[]
  deniedEntries: ReadonlyMap<string, string>
} = {
  entries: [],
  deniedEntries: new Map(),
}

function notify() {
  _snapshot = {
    entries: [..._mountEntries],
    deniedEntries: new Map(_deniedEntries),
  }
  for (const listener of _listeners) listener()
}



/** Subscribe to mount-state changes. Returns an unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/** Get the current cached snapshot. */
export function getSnapshot() {
  return _snapshot
}

// ── Exports ───────────────────────────────────────────────────────────────

/**
 * Synchronous ZenFS filesystem API.
 */
export const fs = zenfsFs

/**
 * Promise-based ZenFS filesystem API.
 */
export const promises = zenfsPromises

/**
 * Mark mount entries whose backend validation failed.
 * They are stored but won't be mounted in ZenFS until the issue is resolved.
 *
 * @param id - The entry id.
 * @param reason - Human-readable reason why the mount was denied.
 */
export function markDenied(id: string, reason: string): void {
  _deniedEntries.set(id, reason)
  notify()
}

/**
 * Remove an entry from the denied map (after reconnection or mount success).
 */
export function clearDenied(id: string): void {
  _deniedEntries.delete(id)
  notify()
}

/**
 * Attempt to reconnect a mount entry that was previously denied.
 *
 * For FSA entries, re-prompts the user for permission before remounting.
 * For IndexedDB entries, attempts a direct remount (no permission needed).
 */
export async function reconnectMount(entryId: string): Promise<void> {
  const entry = _mountEntries.find((e) => e.id === entryId)
  if (!entry) {
    throw new Error(`Mount entry "${entryId}" not found`)
  }

  // Re-validate based on backend kind
  if (entry.backend.kind === "fsa") {
    const granted = await requestHandlePermission(entry.backend.handle)
    if (!granted) {
      throw new Error("Permission denied for directory handle.")
    }
  }
  // IndexedDB entries need no permission re-prompt — just try to mount

  await mountBackend(entry)
  clearDenied(entryId)
  notifyServiceWorker()
}

// ── Service Worker notification ───────────────────────────────────────────

/**
 * Notify the active service worker that mounts have changed.
 *
 * The SW lazily re-reads mount entries from IndexedDB on the next
 * `/@epubs/` request, so this is a lightweight hint rather than an
 * eager reload.
 *
 * Silently handles the case where no service worker is active.
 */
export function notifyServiceWorker(): void {
  const sw = self.navigator?.serviceWorker?.controller
  if (sw) {
    sw.postMessage({ type: "zenfs-reload" })
  }
}

/**
 * Register a mount entry in local state without mounting it in ZenFS.
 * Use this for entries that are saved but not yet active (e.g. mounted: false).
 * Triggers a snapshot update so consumers see the new entry immediately.
 */
export function registerMountEntry(entry: MountEntry): void {
  const idx = _mountEntries.findIndex((e) => e.id === entry.id)
  if (idx !== -1) {
    _mountEntries[idx] = entry
  } else {
    _mountEntries.push(entry)
    // _mountEntries = [..._mountEntries, entry]
  }
  notify()
}


export function deregisterMountEntry(id: string): void {
  _mountEntries = _mountEntries.filter((e) => e.id !== id)
  notify()
}


/**
 * Mount a backend in ZenFS and register it in local state.
 * Uses {@link resolveBackendConfig} to validate and create the backend
 * for the entry's configured backend type.
 */
export async function mountBackend(entry: MountEntry): Promise<void> {
  // Ensure the mount-point directory exists (dynamic mount() requires it).
  try {
    await zenfsPromises.mkdir(entry.mountPath, { recursive: true })
  } catch {
    // already exists — fine
  }

  const resolved = await resolveBackendConfig(entry.backend)
  zenfsMount(entry.mountPath, resolved)

  registerMountEntry({ ...entry, shouldBeMounted: true })
  notifyServiceWorker()
}
/**
 * Unmount a single backend at runtime.
 *
 * The entry stays in the mount list but is marked as unmounted.
 */
export async function unmountBackend(entry: MountEntry): Promise<void> {
  try {
    zenfsUmount(entry.mountPath)

    // remove the mounting directory.
    await zenfsPromises.rmdir(entry.mountPath)

    const idx = _mountEntries.findIndex((e) => e.id === entry.id)
    if (idx !== -1) {
      _mountEntries[idx] = { ..._mountEntries[idx], shouldBeMounted: false }
    }
  } catch (ex) {
    console.error(`Failed to unmount "${entry.mountPath}":`, ex)

  }

  notify()
  // Notify the service worker so it can refresh its mounts
  notifyServiceWorker()
}

/**
 * Check ZenFS root `/` contents — returns all mounted backend mount points
 * as directory names (without the leading `/`).
 */
export async function getMountedPaths(): Promise<string[]> {
  try {
    return (await promises.readdir("/")) as string[]
  } catch {
    return []
  }
}

// ── Standalone mount mutators ─────────────────────────────────────────────

/**
 * Persist a new mount entry and mount it in ZenFS (if `mounted` is true).
 *
 * Combines persistence to IndexedDB, ZenFS mount/registration, and
 * reactive notification into a single operation. This is the canonical
 * entry point for adding mounts — used by both the UI dialog and
 * any future mount-creation flows.
 *
 * @param entry - The mount entry to persist and mount.
 */
export async function addMountEntry(entry: MountEntry): Promise<void> {
  await saveMount(entry)

  if (entry.shouldBeMounted) {
    await mountBackend(entry)
  } else {
    registerMountEntry(entry)
  }
}

/**
 * Toggle a mount entry between mounted and unmounted states.
 *
 * Persists the updated `mounted` flag to IndexedDB and performs the
 * corresponding ZenFS mount or unmount operation.
 *
 * @param entry - The mount entry to toggle.
 */
export async function toggleMountEntry(entry: MountEntry): Promise<void> {
  if (entry.shouldBeMounted) {
    await unmountBackend(entry)
    await updateMount(entry.id, { shouldBeMounted: false })
  } else {
    await mountBackend({ ...entry, shouldBeMounted: true })
    await updateMount(entry.id, { shouldBeMounted: true })
  }
}

/**
 * Permanently remove a mount entry and all its artifacts.
 *
 * Unmounts the backend from ZenFS (if mounted), deletes the entry from
 * IndexedDB, and removes it from reactive state.
 *
 * @param id - The mount entry id to remove.
 */
export async function removeMountEntry(id: string): Promise<void> {
  const entry = _mountEntries.find((e) => e.id === id)
  if (entry?.shouldBeMounted) {
    await unmountBackend(entry)
  }
  await deleteMountFromStore(id)
  deregisterMountEntry(id)
}

/**
 * Reconnect a previously denied mount entry.
 *
 * For FSA entries, re-prompts the user for directory permission.
 * For IndexedDB entries, re-attempts mount without prompting.
 *
 * Delegates to {@link reconnectMount}.
 *
 * @param id - The mount entry id to reconnect.
 */
export async function reconnectMountEntry(id: string): Promise<void> {
  await reconnectMount(id)
}