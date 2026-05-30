/**
 * SW-side ZenFS singleton — independent instance from the frontend.
 *
 * Reads mount entries from IndexedDB (same store as the frontend) and
 * configures `@zenfs/core` with `WebAccess` backends. Supports lazy
 * reconfiguration via a dirty flag set by postMessage from the frontend.
 *
 * @module zenfs-sw
 */

import {
  configure as zenfsConfigure,
  fs as zenfsFs,
  mount as zenfsMount,
  promises as zenfsPromises,
  resolveMountConfig,
  umount as zenfsUmount,
  type Backend,
} from "@zenfs/core"
import { WebAccess } from "@zenfs/dom"
import { loadMounts } from "../lib/mount-store"

// ── Internal state ────────────────────────────────────────────────────────

let _configured = false
let _mountsDirty = false

/** Set of mount paths from the last successful configure — used to avoid
 *  re-mounting the same paths, which would throw "Mount point is already in use." */
let _prevMountPaths = new Set<string>()

/**
 * Ensure the SW's ZenFS instance is configured with the latest mounts from
 * IndexedDB.
 *
 * Re-reads from IDB and reconfigures when:
 * - Not yet configured, or
 * - `_mountsDirty` is true (set by postMessage) **and** the set of mount
 *   paths has changed.  If the paths are the same, ZenFS already has
 *   those mounts; re-configuring would fail with "Mount point is already
 *   in use."
 *
 * **Note about stale file data:** when both SW and frontend share a
 * mounted backend, the SW may see stale inode data if the frontend
 * rewrites files.  That is a separate concern from mount management and
 * should be addressed at the file-reading layer (e.g. re-reading on
 * every request rather than caching inodes).
 */
export async function ensureZenFS(): Promise<void> {
  // Re-read mount entries from IndexedDB
  const entries = await loadMounts()

  // Build mount map from mounted entries (mountPath → handle)
  const nextMounts = new Map<string, FileSystemDirectoryHandle>()
  for (const entry of entries) {
    if (!entry.mounted) continue
    nextMounts.set(entry.mountPath, entry.handle)
  }

  const nextMountPaths = new Set(nextMounts.keys())

  // First-time initialization: if nothing configured yet, do initial
  // configure (or early-return if nothing to mount).
  if (!_configured) {
    if (nextMountPaths.size === 0) return // nothing to mount

    const mounts: Record<string, { backend: Backend; handle: FileSystemDirectoryHandle }> = {}
    for (const [mp, handle] of nextMounts) {
      mounts[mp] = { backend: WebAccess, handle }
    }
    try {
      console.log("[SW ZenFS] initial configure, mounting:", [...nextMountPaths])
      await zenfsConfigure({ mounts })
    } catch (e) {
      console.error("[SW ZenFS] initial configure failed (permission revoked?):", e)
      _mountsDirty = true
      return
    }
    _configured = true
    _prevMountPaths = new Set(nextMountPaths)
    _mountsDirty = false
    return
  }

  // Already configured — compute deltas against previous mount set.
  //   toUnmount = prev – next   (paths that were mounted but no longer are)
  //   toMount   = next – prev   (paths that are now mounted but weren't before)
  const toUnmount = setDifference(_prevMountPaths, nextMountPaths)
  const toMount = setDifference(nextMountPaths, _prevMountPaths)

  if (toUnmount.size === 0 && toMount.size === 0) {
    _mountsDirty = false
    return
  }

  // ── Unmount stale paths ──────────────────────────────────────────────
  for (const mp of toUnmount) {
    try {
      zenfsUmount(mp)
      console.log("[SW ZenFS] unmounted:", mp)
    } catch (e) {
      console.error(`[SW ZenFS] unmount failed for "${mp}":`, e)
    }
  }

  // ── Mount new paths ──────────────────────────────────────────────────
  for (const mp of toMount) {
    const handle = nextMounts.get(mp)!
    try {
      // Ensure the mount-point directory exists
      try { await zenfsPromises.mkdir(mp, { recursive: true }) } catch { /* already exists */ }

      const resolved = await resolveMountConfig({ backend: WebAccess, handle })
      zenfsMount(mp, resolved)
      console.log("[SW ZenFS] mounted:", mp)
    } catch (e) {
      console.error(`[SW ZenFS] mount failed for "${mp}":`, e)
    }
  }

  _prevMountPaths = new Set(nextMountPaths)
  _mountsDirty = false
}

/** Set difference: elements in `a` that are not in `b`. */
function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>()
  for (const item of a) {
    if (!b.has(item)) result.add(item)
  }
  return result
}

/**
 * Mark the mount state as potentially stale.
 *
 * Called by the `message` event listener when the frontend posts
 * `{ type: "zenfs-reload" }`. The next call to {@link ensureZenFS}
 * will re-read from IndexedDB.
 */
export function markMountsDirty(): void {
  _mountsDirty = true
}

/**
 * Find the mounted path that is the longest prefix of `path`.
 *
 * Given a ZenFS path like `/epubs/ch1/section.html` and mounted paths
 * like `["/", "/epubs", "/notes"]`, this returns `"/epubs"` (the longest
 * matching prefix). Returns `null` if no mount path is a prefix.
 */
export function findLongestPrefix(path: string, mountPaths: string[]): string | null {
  let best: string | null = null
  for (const mp of mountPaths) {
    const normalized = mp.endsWith("/") ? mp : mp + "/"
    if (path.startsWith(normalized) && (best === null || mp.length > best.length)) {
      best = mp
    }
  }
  return best
}

/**
 * Check whether the pathname starts with `/@epubs/`.
 * Used by the 404 catch-all to exempt EPUB html routes.
 */
export function isEpubRoutePath(pathname: string): boolean {
  return pathname.startsWith("/@epubs/")
}

export { zenfsFs, zenfsPromises }
