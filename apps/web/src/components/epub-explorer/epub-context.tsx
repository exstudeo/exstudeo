/**
 * @file epub-context.tsx
 *
 * React context that provides a {@link ViewModel} instance to the EPUB
 * explorer component tree.
 *
 * ## Pattern
 *
 * - `useRef` holds a stable ViewModel instance across renders (created once)
 * - `useSyncExternalStore` subscribes to ViewModel changes for reactivity
 * - The ViewModel itself does NOT require cleanup — `subscribe()` returns an
 *   unsubscribe function that React calls when the component unmounts.
 *
 * @module epub-context
 */

import {
  createContext,
  useContext,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { ViewModel } from "@/lib/epub-lib/view-model"
import { type AppConfig } from "@/config"
import { type EpubCollection } from "@/lib/epub-lib/type"
import type { promises as ZenFSPromises } from "@/lib/zenfs"

/** Value exposed by the EPUB context. */
export interface EpubContextValue {
  /** The stable ViewModel instance (for mutations). */
  viewModel: ViewModel
  /** The current reactive collection snapshot. */
  collection: EpubCollection
}

const EpubContext = createContext<EpubContextValue | null>(null)

/**
 * Provider that instantiates a {@link ViewModel} and makes it available
 * to all children via {@link useEpubContext}.
 *
 * The ViewModel is created once (via `useRef`) and persists across
 * re-renders. Reactivity is handled by `useSyncExternalStore`, so
 * consuming components only re-render when the collection changes.
 *
 * No cleanup is required from the ViewModel side — the subscribe function
 * returns an unsubscribe callback that React calls on unmount.
 */
export default function EpubContextProvider({
  appConfig,
  promises: promisesFs,
  children,
}: {
  appConfig: AppConfig
  promises: typeof ZenFSPromises
  children: ReactNode
}) {
  // Stable reference — created once, never re-created on re-render
  const vmRef = useRef<ViewModel | null>(null)
  if (!vmRef.current) {
    vmRef.current = new ViewModel(appConfig, promisesFs)
  }

  // Async init — load collection from storage on mount
  const [initialising, setInitialising] = useState(true)
  useEffect(() => {
    let cancelled = false
    vmRef.current!.init().then(() => {
      if (!cancelled) setInitialising(false)
    })
    return () => { cancelled = true }
  }, [])

  // Reactive subscription via useSyncExternalStore
  const collection = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => {
      return vmRef.current!.subscribe(onStoreChange)
    }, []),
    useCallback(() => vmRef.current!.getCollectionSnapshot(), []),
  )

  const value = useMemo<EpubContextValue>(
    () => ({ viewModel: vmRef.current!, collection }),
    [collection],
  )

  if (initialising) {
    return (
      <EpubContext.Provider value={value}>
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
          Loading EPUB collection…
        </div>
      </EpubContext.Provider>
    )
  }

  return <EpubContext.Provider value={value}>{children}</EpubContext.Provider>
}

/**
 * Access the current EPUB context.
 *
 * Must be called inside an {@link EpubContextProvider}.
 */
export function useEpubContext(): EpubContextValue {
  const ctx = useContext(EpubContext)
  if (!ctx) {
    throw new Error("useEpubContext must be used within an EpubContextProvider")
  }
  return ctx
}