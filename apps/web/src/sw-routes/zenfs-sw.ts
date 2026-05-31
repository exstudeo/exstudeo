/**
 * SW-side ZenFS singleton — independent instance from the frontend.
 *
 * Reads mount entries from IndexedDB (same store as the frontend) and
 * configures `@zenfs/core` with the appropriate backends for each entry.
 * Supports lazy reconfiguration via a dirty flag set by postMessage from
 * the frontend.
 *
 * @module zenfs-sw
 */

import {
  configure as zenfsConfigure,
  fs as zenfsFs,
  mount as zenfsMount,
  promises as zenfsPromises,
  umount as zenfsUmount,
} from "@zenfs/core"
import { loadMounts } from "../lib/mount-store"
import {
  resolveBackendConfig,
  type BackendConfig,
} from "../lib/backend-resolver"

// ── Internal state ────────────────────────────────────────────────────────

let _configured = false
let _mountsDirty = false

/** Set of `${mountPath}::${backendKind}` strings from the last successful
 *  configure — used to avoid re-mounting the same paths, which would throw
 *  "Mount point is already in use."  Includes backend kind so a path
 *  changing backend type (e.g., FSA → IndexedDB) is detected as a change. */
let _prevMountKeys = new Set<string>()

/**
 * Ensure the SW's ZenFS instance is configured with the latest mounts from
 * IndexedDB.
 *
 * Re-reads from IDB and reconfigures when:
 * - Not yet configured, or
 * - `_mountsDirty` is true (set by postMessage) **and** the set of
 *   mount paths or their backend kinds has changed.  If nothing changed,
 *   ZenFS already has those mounts; re-configuring would fail with
 *   "Mount point is already in use."
 *
 * **Note about stale file data:** when both SW and frontend share a
 * mounted backend, the SW may see stale inode data if the frontend
 * rewrites files.  That is a separate concern from mount management and
 * should be addressed at the file-reading layer (e.g. re-reading on
 * every request rather than caching inodes).
 */
export async function ensureZenFS(): Promise<void> {
  // Re-read mount entries from IndexedDB (normalized by loadMounts)
  const entries = await loadMounts()

  // Build mount map from mounted entries (mountPath → BackendConfig)
  const nextMounts = new Map<string, BackendConfig>()
  for (const entry of entries) {
    if (!entry.mounted) continue
    nextMounts.set(entry.mountPath, entry.backend)
  }

  // Build mount keys that include backend kind (for change detection)
  const nextMountKeys = new Set<string>()
  for (const [mp, cfg] of nextMounts) {
    nextMountKeys.add(`${mp}::${cfg.kind}`)
  }

  // First-time initialization: if nothing configured yet, do initial
  // configure (or early-return if nothing to mount).
  if (!_configured) {
    if (nextMounts.size === 0) return // nothing to mount

    const mounts: Record<string, Awaited<ReturnType<typeof resolveBackendConfig>>> = {}
    for (const [mp, cfg] of nextMounts) {
      try {
        mounts[mp] = await resolveBackendConfig(cfg)
      } catch (e) {
        console.error(`[SW ZenFS] failed to resolve backend for "${mp}":`, e)
      }
    }
    try {
      console.log("[SW ZenFS] initial configure, mounting:", [...nextMountKeys])
      await zenfsConfigure({ mounts })
    } catch (e) {
      console.error("[SW ZenFS] initial configure failed:", e)
      _mountsDirty = true
      return
    }
    _configured = true
    _prevMountKeys = new Set(nextMountKeys)
    _mountsDirty = false
    return
  }

  // Already configured — compute deltas against previous mount set.
  //   toUnmount = prev – next   (paths that were mounted but no longer are)
  //   toMount   = next – prev   (paths that are now mounted but weren't before)
  const toUnmount = setDifference(_prevMountKeys, nextMountKeys)
  const toMount = setDifference(nextMountKeys, _prevMountKeys)

  if (toUnmount.size === 0 && toMount.size === 0) {
    _mountsDirty = false
    return
  }

  // ── Unmount stale paths ──────────────────────────────────────────────
  for (const key of toUnmount) {
    const mp = key.split("::")[0] // extract mountPath from "mountPath::kind"
    try {
      zenfsUmount(mp)
      console.log("[SW ZenFS] unmounted:", mp)
    } catch (e) {
      console.error(`[SW ZenFS] unmount failed for "${mp}":`, e)
    }
  }

  // ── Mount new paths ──────────────────────────────────────────────────
  for (const key of toMount) {
    const mp = key.split("::")[0] // extract mountPath from "mountPath::kind"
    const cfg = nextMounts.get(mp)
    if (!cfg) continue
    try {
      // Ensure the mount-point directory exists
      try { await zenfsPromises.mkdir(mp, { recursive: true }) } catch { /* already exists */ }

      const resolved = await resolveBackendConfig(cfg)
      zenfsMount(mp, resolved)
      console.log("[SW ZenFS] mounted:", mp, `(${cfg.kind})`)
    } catch (e) {
      console.error(`[SW ZenFS] mount failed for "${mp}":`, e)
    }
  }

  _prevMountKeys = new Set(nextMountKeys)
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
