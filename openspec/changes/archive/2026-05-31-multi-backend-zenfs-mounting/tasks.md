## 1. Data Model — BackendConfig & MountEntry

- [x] 1.1 Define `BackendConfig`, `FsaConfig`, `IndexedDBConfig` types in `mount-store.ts`
- [x] 1.2 Add optional `backend` field to `MountEntry`; mark `handle` as optional/deprecated with TSDoc
- [x] 1.3 Add `normalizeMountEntry()` helper that synthesizes `backend: { kind: 'fsa', handle }` for legacy entries missing `backend`
- [x] 1.4 Update `loadMounts()` to call `normalizeMountEntry()` on every loaded entry
- [x] 1.5 Update `saveMount()` and `updateMount()` to store `backend` field; keep writing `handle` for backward compat on FSA entries

## 2. Backend Resolver

- [x] 2.1 Create `lib/backend-resolver.ts` with `BackendConfig` re-export, `BackendValidationError` class, and `resolveBackendConfig()`
- [x] 2.2 Implement FSA resolution: check `handle.queryPermission("readwrite")`, then `resolveMountConfig({ backend: WebAccess, handle })`
- [x] 2.3 Implement IndexedDB resolution: check `IndexedDB.isAvailable()`, auto-derive `storeName` from config, then `resolveMountConfig({ backend: IndexedDB, storeName })`
- [x] 2.4 Export `storeNameFromPath()` helper: converts mount path to store name (e.g., `/cache` → `zenfs-cache`)

## 3. Frontend ZenFS (`lib/zenfs.ts`)

- [x] 3.1 Remove `import { WebAccess }` — use `resolveBackendConfig()` from `lib/backend-resolver.ts` instead
- [x] 3.2 Refactor `_skippedIds` (Set) → `_deniedEntries` (Map<string, string>) with reason strings
- [x] 3.3 Update `notify()` snapshot: `deniedEntries: new Map(_deniedEntries)` instead of `deniedIds: [...]`
- [x] 3.4 Update `markSkipped()` → `markDenied(id, reason)` — accept a reason string
- [x] 3.5 Update `clearSkipped()` → `clearDenied(id)` (functionally same, naming updated)
- [x] 3.6 Update `mountBackend()` to call `resolveBackendConfig(entry.backend)` instead of inline WebAccess creation
- [x] 3.7 Update `reconnectMount()` to branch on backend kind: FSA → re-prompt + remount; IndexedDB → direct remount (no permission needed)

## 4. Service Worker ZenFS (`sw-routes/zenfs-sw.ts`)

- [x] 4.1 Remove `import { WebAccess }` — use `resolveBackendConfig()` from `lib/backend-resolver.ts` instead
- [x] 4.2 Update `ensureZenFS()` initial configure: iterate entries, build mounts map using `resolveBackendConfig(entry.backend)`
- [x] 4.3 Update `ensureZenFS()` delta mount/unmount: use `resolveBackendConfig()` for new mounts
- [x] 4.4 Update mount-hash tracking (`_prevMountPaths`): consider backend kind in change detection (a path changing from FSA to IDB is a change)

## 5. React Hook (`hooks/use-zenfs.ts`)

- [x] 5.1 Update `ZenFSState` interface: replace `skippedIds: string[]` with `deniedEntries: ReadonlyMap<string, string>`
- [x] 5.2 Update `reconnectMount` callback: allow IndexedDB entries through without re-prompting
- [x] 5.3 Update `addMount` callback: pass `backend` config through to `mountBackend()`

## 6. Mount Dialog UI (`components/layout/mounts-dialog.tsx`)

- [x] 6.1 Add backend type dropdown ("File System Access" / "IndexedDB") above the add form
- [x] 6.2 Adapt `AddMountForm`: when "IndexedDB" is selected, create mount immediately on "Add" click (no directory picker); derive `storeName` from path
- [x] 6.3 Adapt `AddMountForm`: when "FSA" is selected, use existing `showDirectoryPicker()` flow
- [x] 6.4 Update `MountRow` to show backend type label (e.g., "FSA", "IndexedDB")
- [x] 6.5 Update `MountRow` skipped state: use `zenfs.deniedEntries` instead of `zenfs.skippedIds`; show reason text
- [x] 6.6 Conditionally show reconnect button: only for FSA entries in `deniedEntries`; hide for IndexedDB entries

## 7. Verification & Cleanup

- [x] 7.1 Manual test: create an FSA mount, verify it works as before
- [x] 7.2 Manual test: create an IndexedDB mount, verify files persist across reloads
- [x] 7.3 Manual test: toggle both backend types between mounted/unmounted
- [x] 7.4 Manual test: remove mounts of both types, verify IndexedDB database is cleaned up
- [x] 7.5 Manual test: verify EPUB file serving still works through service worker (FSA mount at `/epubs`)
- [x] 7.6 Verify backward compat: mount entry with `handle` but no `backend` field normalizes and mounts correctly
- [x] 7.7 Run `npm run typecheck` and `npm run lint` — ensure no new errors
- [x] 7.8 Append change summary to `Development.log.md`