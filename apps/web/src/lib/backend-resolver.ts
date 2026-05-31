/**
 * Shared backend resolution — maps {@link BackendConfig} to ZenFS mount
 * configurations for use by both the frontend (`lib/zenfs.ts`) and the
 * service worker (`sw-routes/zenfs-sw.ts`).
 *
 * This is the ONLY module that imports backend implementations
 * (`WebAccess`, `IndexedDB`) from `@zenfs/dom`.
 *
 * @module backend-resolver
 */

import { resolveMountConfig } from "@zenfs/core"
import { WebAccess, IndexedDB } from "@zenfs/dom"
import type { BackendConfig, FsaConfig, IndexedDBConfig } from "./mount-store"

export type { BackendConfig, FsaConfig, IndexedDBConfig }

/**
 * Error thrown by {@link resolveBackendConfig} when backend-specific
 * validation fails (e.g., FSA permission denied, IndexedDB unavailable).
 */
export class BackendValidationError extends Error {
  /** The backend kind that failed validation. */
  public readonly kind: BackendConfig["kind"]

  constructor(kind: BackendConfig["kind"], message: string) {
    super(`[${kind}] ${message}`)
    this.name = "BackendValidationError"
    this.kind = kind
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Derive an IndexedDB store name from a mount path.
 *
 * @example
 * ```ts
 * storeNameFromPath("/cache")   // "zenfs-cache"
 * storeNameFromPath("/epubs")   // "zenfs-epubs"
 * ```
 */
export function storeNameFromPath(mountPath: string): string {
  // Remove leading /, replace remaining / with -, strip trailing -
  return (
    "zenfs-" +
    mountPath
      .replace(/^\//, "")
      .replace(/\//g, "-")
      .replace(/-+$/, "")
  )
}

// ── Resolution ────────────────────────────────────────────────────────────

type ResolvedBackend = Awaited<ReturnType<typeof resolveMountConfig>>

/**
 * Resolve a {@link BackendConfig} to a ZenFS mount configuration.
 *
 * Performs backend-specific validation before resolution:
 * - **FSA**: checks that the directory handle still has `readwrite` permission.
 * - **IndexedDB**: checks that IndexedDB is available in the browser.
 *
 * @throws {BackendValidationError} if validation fails.
 */
export async function resolveBackendConfig(
  cfg: BackendConfig,
): Promise<ResolvedBackend> {
  switch (cfg.kind) {
    case "fsa": {
      // Validate: handle must still have readwrite permission
      const result = await cfg.handle.queryPermission({ mode: "readwrite" })
      if (result !== "granted") {
        throw new BackendValidationError(
          "fsa",
          "Permission denied for directory handle.",
        )
      }
      return resolveMountConfig({ backend: WebAccess, handle: cfg.handle })
    }

    case "indexeddb": {
      // Validate: IndexedDB must be available
      const available = await IndexedDB.isAvailable({})
      if (!available) {
        throw new BackendValidationError(
          "indexeddb",
          "IndexedDB is not available in this browser.",
        )
      }
      const storeName = cfg.storeName ?? "zenfs"
      return resolveMountConfig({ backend: IndexedDB, storeName })
    }
  }
}