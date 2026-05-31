## Why

ZenFS currently hard-codes a single backend type — `WebAccess` (File System Access API) — across the mount data model, frontend ZenFS singleton, service worker ZenFS, and the mount dialog UI. Adding a second backend (IndexedDB) or any future backend requires touching all four layers. This refactor generalizes the mount architecture to support multiple backend types with a clean discriminated-union model, making it straightforward to add `InMemory`, `WebStorage`, or `Fetch` backends later.

## What Changes

- **Add `BackendConfig` discriminated union** (`fsa` | `indexeddb`) as a shared type defining how each backend is configured and resolved
- **Extend `MountEntry`** with a `backend` field; make the existing `handle` field optional for backward compatibility with persisted data
- **Create `lib/backend-resolver.ts`** — a single function `resolveBackendConfig()` that maps `BackendConfig` → ZenFS mount configuration, used by both the frontend (`zenfs.ts`) and service worker (`zenfs-sw.ts`)
- **Add IndexedDB backend support** — mounts can now use the `IndexedDB` backend from `@zenfs/dom` (already installed), backed by browser IndexedDB storage with no permission prompts required
- **Refactor `skippedIds` → `deniedEntries`** — the denied/permission-lost mechanism becomes backend-aware; only FSA mounts can be denied (permission revocation), IndexedDB mounts never need reconnection
- **Update mount dialog UI** — adds backend type dropdown (FSA / IndexedDB), adapts the add form per backend (FSA shows directory picker, IndexedDB creates immediately), shows backend type label on each mount row
- **Auto-derive `storeName`** for IndexedDB mounts from `mountPath` to avoid collisions (e.g., `/cache` → `zenfs-cache`)

## Capabilities

### New Capabilities
- `indexeddb-backend`: Support for IndexedDB as a ZenFS storage backend, including availability detection, store name derivation, and auto-mount lifecycle

### Modified Capabilities
- `mount-management`: MountEntry data model gains a `backend` field with `BackendConfig` discriminated union; `handle` becomes optional/deprecated for backward compatibility; validation becomes backend-specific; path uniqueness enforcement and IndexedDB persistence remain unchanged
- `zenfs-integration`: Frontend ZenFS singleton uses `resolveBackendConfig()` instead of hardcoded `WebAccess`; `skippedIds` becomes `deniedEntries` (Map with reason strings); reconnect becomes backend-aware; SW ZenFS (`zenfs-sw.ts`) also uses `resolveBackendConfig()`; `notifyServiceWorker()` is preserved for all backend types

## Impact

- **`apps/web/src/lib/mount-store.ts`** — add `BackendConfig`, `FsaConfig`, `IndexedDBConfig` types; make `handle` optional; add `normalizeMountEntry()` for backward compat
- **`apps/web/src/lib/zenfs.ts`** — replace `import { WebAccess }` with `resolveBackendConfig()`; refactor `skippedIds` → `deniedEntries`
- **`apps/web/src/lib/backend-resolver.ts`** (NEW) — `resolveBackendConfig()`, `BackendValidationError`
- **`apps/web/src/sw-routes/zenfs-sw.ts`** — replace `import { WebAccess }` with `resolveBackendConfig()`
- **`apps/web/src/hooks/use-zenfs.ts`** — expose `deniedEntries` map instead of `skippedIds`
- **`apps/web/src/components/layout/mounts-dialog.tsx`** — backend type dropdown, conditional add form, backend type labels on rows, reconnect only for FSA
- **No changes**: `config.ts`, `config-store.ts`, `use-config.ts`, `file-explorer/` components