/**
 * React hook for consuming the global ZenFS mount state reactively.
 *
 * Provides read-only access to mount entries, denied entries, and a
 * `hasEntries` convenience flag. Components using this hook re-render
 * whenever mounts change.
 *
 * For filesystem operations, import `{ fs, promises }` directly from
 * `@/lib/zenfs`. For mutations, use the standalone mutator functions
 * (`addMountEntry`, `toggleMountEntry`, `removeMountEntry`, `reconnectMountEntry`).
 *
 * @module use-zenfs
 */

import { useSyncExternalStore, useMemo } from "react"
import { subscribe, getSnapshot } from "@/lib/zenfs"
import type { MountEntry } from "@/lib/mount-store"

/** Read-only snapshot of ZenFS mount state exposed by {@link useZenFSSnapshot}. */
export interface ZenFSSnapshot {
  /** Whether ZenFS has any mount entries. */
  hasEntries: boolean
  /** All mount entries (including unmounted). */
  entries: MountEntry[]
  /**
   * Entries that failed to mount, mapped to their failure reason.
   * FSA entries appear here when permission is denied; IndexedDB entries
   * appear here when `isAvailable()` returns false.
   */
  deniedEntries: ReadonlyMap<string, string>
}

/**
 * Hook that provides reactive read-only access to the ZenFS mount state.
 *
 * The returned object is reference-stable across renders unless the
 * underlying mount state has changed (guaranteed by `useMemo`).
 *
 * @example
 * ```tsx
 * function FileList() {
 *   const { entries, hasEntries } = useZenFSSnapshot()
 *   // read FS with: import { promises } from "@/lib/zenfs"
 * }
 * ```
 */
export function useZenFSSnapshot(): ZenFSSnapshot {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

  return useMemo(
    () => ({
      hasEntries: snapshot.entries.length > 0,
      entries: snapshot.entries,
      deniedEntries: snapshot.deniedEntries,
    }),
    [snapshot.entries, snapshot.deniedEntries],
  )
}

/**
 * @deprecated Use {@link useZenFSSnapshot} instead.
 */
export const useZenFS = useZenFSSnapshot