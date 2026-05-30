/**
 * React hook for consuming the global ZenFS singleton.
 *
 * Provides reactive access to `fs`, `promises`, mount entries, and derived
 * state (e.g., mounted paths). Components using this hook re-render whenever
 * mounts change.
 *
 * @module use-zenfs
 */

import { useSyncExternalStore, useCallback } from "react"
import {
  fs,
  promises,
  subscribe,
  getSnapshot,
  mountBackend,
  unmountBackend,
  reconnectMount as reconnectMountInternal,
  registerMountEntry,
  deregisterMountEntry,
} from "@/lib/zenfs"
import {
  saveMount,
  deleteMount as deleteMountFromStore,
  updateMount,
  type MountEntry,
} from "@/lib/mount-store"

export interface ZenFSState {
  /** Synchronous ZenFS filesystem API. */
  fs: typeof fs
  /** Promise-based ZenFS filesystem API. */
  promises: typeof promises
  /** Whether ZenFS has any mount entries. */
  hasEntries: boolean
  /** All mount entries (including unmounted). */
  entries: MountEntry[]
  /** IDs of entries whose FSA handle permission was denied on startup. */
  skippedIds: string[]
  /** Persist a new mount entry and mount it. */
  addMount: (entry: MountEntry) => Promise<void>
  /** Toggle a mount entry between mounted/unmounted. */
  toggleMount: (entry: MountEntry) => Promise<void>
  /** Permanently remove a mount entry. */
  removeMount: (id: string) => Promise<void>
  /** Reconnect a denied mount entry (prompts user for permission). */
  reconnectMount: (id: string) => Promise<void>
}

/**
 * Hook that provides reactive access to the global ZenFS state.
 *
 * @example
 * ```tsx
 * function FileList() {
 *   const { fs, entries, mountedPaths } = useZenFS()
 *   // ...
 * }
 * ```
 */
export function useZenFS(): ZenFSState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)

const addMount = useCallback(async (entry: MountEntry) => {
  await saveMount(entry)          // 1. persist to IndexedDB

  if (entry.mounted) {
    await mountBackend(entry)     // 2a. mount in ZenFS + register in state
  } else {
    registerMountEntry(entry)     // 2b. register in state only, no ZenFS mount
  }
}, [])
const toggleMount = useCallback(async (entry: MountEntry) => {
  if (entry.mounted) {
    await unmountBackend(entry)
    await updateMount(entry.id, { mounted: false })
  } else {
    await mountBackend({ ...entry, mounted: true })
    await updateMount(entry.id, { mounted: true })
  }
}, [])


const removeMount = useCallback(async (id: string) => {
  const { entries } = getSnapshot()
  const entry = entries.find((e) => e.id === id)
  if (entry?.mounted) {
    await unmountBackend(entry)
  }
  await deleteMountFromStore(id)   // remove from IndexedDB
  deregisterMountEntry(id)         // remove from _mountEntries + notify
}, [])

  const reconnectMount = useCallback(
    async (id: string) => {
      await reconnectMountInternal(id)
    },
    [],
  )

  return {
    fs,
    promises,
    hasEntries: snapshot.entries.length > 0,
    entries: snapshot.entries,
    skippedIds: snapshot.deniedIds,
    addMount,
    toggleMount,
    removeMount,
    reconnectMount,
  }
}