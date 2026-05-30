/**
 * React hook for consuming the config store.
 *
 * Provides reactive access to the full {@link AppConfig} with the ability
 * to update or reset individual domains. Components using this hook
 * re-render whenever config changes.
 *
 * Mirrors the pattern in {@link use-zenfs}.
 *
 * @module use-config
 */

import { useSyncExternalStore, useCallback } from "react"
import {
  subscribe,
  getSnapshot,
  setConfig,
  resetConfig,
} from "@/lib/config-store"
import type { AppConfig, ConfigDomain } from "@/config"

export interface ConfigState {
  /** The full merged application configuration. */
  config: AppConfig
  /**
   * Update a single config domain.
   * The partial values are merged over the existing stored values.
   */
  setDomain: <K extends ConfigDomain>(
    key: K,
    partial: Partial<AppConfig[K]>,
  ) => Promise<void>
  /**
   * Reset one or all config domains to defaults.
   * If no key is provided, ALL domains are reset.
   */
  resetDomain: (key?: ConfigDomain) => Promise<void>
}

/**
 * Hook that provides reactive access to the application config.
 *
 * @example
 * ```tsx
 * function EpubSettings() {
 *   const { config, setDomain } = useConfig()
 *   return <p>EPUB path: {config.epub.zenFSPath}</p>
 * }
 * ```
 */
export function useConfig(): ConfigState {
  const config = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setDomain = useCallback(
    async <K extends ConfigDomain>(key: K, partial: Partial<AppConfig[K]>) => {
      await setConfig(key, partial)
    },
    [],
  )

  const resetDomain = useCallback(async (key?: ConfigDomain) => {
    await resetConfig(key)
  }, [])

  return {
    config,
    setDomain,
    resetDomain,
  }
}