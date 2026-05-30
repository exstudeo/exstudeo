/**
 * Global ZenFS singleton — exposes the virtual filesystem.
 *
 * The exported `promises` object provides a POSIX filesystem API backed by
 * the user's selected directories via the WebAccess backend.
 *
 * Supports dynamic mount/unmount at runtime.
 *
 * @module zenfs
 */

import {
  fs as zenfsFs,
  promises as zenfsPromises,
  mount as zenfsMount,
  umount as zenfsUmount,
  resolveMountConfig,
} from "@zenfs/core"
import { WebAccess } from "@zenfs/dom"
import {
  requestHandlePermission,
  type MountEntry,
} from "@/lib/mount-store"

// ── Reactive state ────────────────────────────────────────────────────────

type Listener = () => void

/** All mount entries, including unmounted ones. */
let _mountEntries: MountEntry[] = []
let _skippedIds = new Set<string>()
const _listeners = new Set<Listener>()

/** Cached snapshot for useSyncExternalStore — updated only on change. */
let _snapshot: {
  entries: MountEntry[]
  deniedIds: string[]
} = {
  entries: [],
  deniedIds: [],
}

function notify() {
  _snapshot = {
    entries: [..._mountEntries],
    deniedIds: [..._skippedIds],
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
 * Mark mount entries whose FSA handle permission was denied.
 * They are stored but won't be passed to ZenFS until reconnected.
 */
export function markSkipped(ids: string[]): void {
  for (const id of ids) {
    _skippedIds.add(id)
  }
  notify()
}

/**
 * Remove an entry from the skipped set (after permission is re-granted).
 */
export function clearSkipped(id: string): void {
  _skippedIds.delete(id)
  notify()
}

export async function reconnectMount(entryId: string): Promise<void> {
  const entry = _mountEntries.find((e) => e.id === entryId)
  if (!entry) {
    throw new Error(`Mount entry "${entryId}" not found`)
  }

  const granted = await requestHandlePermission(entry.handle)
  if (!granted) {
    throw new Error("Permission denied for directory handle.")
  }

  // Mount the backend (handles already-configured state)
  await mountBackend(entry)
  clearSkipped(entryId)
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
 * Assumes the entry's handle has been granted permission.
 */
export async function mountBackend(entry: MountEntry): Promise<void> {
  // Ensure the mount-point directory exists (dynamic mount() requires it).
  // configure() did this internally, but per-entry mountBackend() does not.
  try {
    await zenfsPromises.mkdir(entry.mountPath, { recursive: true })
  } catch {
    // already exists — fine
  }

  const resolved = await resolveMountConfig({
    backend: WebAccess,
    handle: entry.handle,
  })
  zenfsMount(entry.mountPath, resolved)

  registerMountEntry({ ...entry, mounted: true })  // reuse, always marks mounted: true
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
    const idx = _mountEntries.findIndex((e) => e.id === entry.id)
    if (idx !== -1) {
      _mountEntries[idx] = { ..._mountEntries[idx], mounted: false }
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