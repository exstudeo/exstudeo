## Context

ZenFS's `lib/zenfs.ts` and `sw-routes/zenfs-sw.ts` both directly import `WebAccess` from `@zenfs/dom`, hard-coding a single backend type. The `MountEntry` interface has `handle: FileSystemDirectoryHandle` as a required field — only meaningful for FSA backends. The `skippedIds` set and `reconnectMount()` function are also FSA-specific (permission re-prompting).

The `@zenfs/dom` package (already installed at `^1.2.9`) exports `IndexedDB`, `WebStorage`, and `XML` backends in addition to `WebAccess`. Adding IndexedDB support requires generalizing four touchpoints: data model, frontend ZenFS, SW ZenFS, and UI.

The EPUB reader change (`implement-epub-viewer`) is in-progress with 55/62 tasks done. This refactor should not conflict with it — the affected files (`zenfs.ts`, `zenfs-sw.ts`, `mount-store.ts`, `mounts-dialog.tsx`, `use-zenfs.ts`) are distinct from the EPUB viewer files.

## Goals / Non-Goals

**Goals:**
- Decouple backend type from the mount data model, ZenFS wiring, and UI
- Add IndexedDB as a first-class backend (no picker, no permission, instant setup)
- Keep full backward compatibility with persisted `MountEntry` records
- Share backend resolution logic between frontend and service worker
- Make adding future backends (`InMemory`, `WebStorage`, `Fetch`) trivial — just add a variant to the union

**Non-Goals:**
- Add `InMemory`, `WebStorage`, `Fetch`, `Port`, or other backends besides IndexedDB
- Change how `fsUrlBidirectional` or the file explorer works
- Modify the EPUB viewer or its HTML rewrite pipeline
- Add backend-specific configuration dialogs beyond basic name/path
- Allow multiple backends per mount entry (one backend per mount point)

## Decisions

### Decision 1: Discriminated union `BackendConfig` on `MountEntry`

Use a `backend` field containing `BackendConfig` (discriminated union: `{ kind: 'fsa', handle }` | `{ kind: 'indexeddb', storeName? }`). The old `handle` field becomes optional with a comment marking it as deprecated for backward compat.

**Rationale**: Cleanly separates backend configuration from mount metadata. TypeScript's discriminated unions give exhaustive checking in `switch` statements and `if/else` branches. IndexedDB stores this nicely since `BackendConfig` is serializable (FSA handles support structured cloning; IndexedDB configs are plain objects).

**Alternatives considered**:
- **Strategy pattern with `BackendAdapter` interface**: Overengineered for 2 backends. Can evolve from the union if we hit 4+ backends.
- **Keep `handle` and add nullable `storeName`**: Fragile — doesn't prevent invalid combinations (both set, neither set). Discriminated union is type-safe.

### Decision 2: Shared `resolveBackendConfig()` in `lib/backend-resolver.ts`

A single function that maps `BackendConfig` → `resolveMountConfig({ backend, ...options })`. Used by both `zenfs.ts` and `zenfs-sw.ts`. Validates per backend (FSA: check permission; IndexedDB: check `isAvailable()`). Throws `BackendValidationError` on failure.

```
lib/backend-resolver.ts
┌─────────────────────────────────────────┐
│  resolveBackendConfig(cfg)              │
│    switch cfg.kind:                     │
│      'fsa'       → WebAccess + handle   │
│      'indexeddb' → IndexedDB + storeName│
│  ← both import from @zenfs/dom          │
└──────────────┬──────────────────────────┘
               │ used by
     ┌─────────┴─────────┐
     ▼                   ▼
  zenfs.ts           zenfs-sw.ts
```

**Rationale**: The only place that imports `WebAccess` and `IndexedDB` directly. Both frontend and SW need the same resolution logic. A shared function prevents divergence. Adding a third backend means adding one case to the switch and one import.

**Alternatives considered**:
- **Inline resolution in both files**: Duplicates logic, risks divergence. Rejected.
- **Export from `zenfs.ts` and import in SW**: SW bundles separately; importing from `lib/` works fine since both compile from the same `src/`.

### Decision 3: `skippedIds` → `deniedEntries` (Map with reasons)

Replace `Set<string>` with `Map<string, string>` mapping `entryId → reason`. Updates the `ZenFSState` interface and the snapshot.

**Rationale**: Backend-specific error reasons let the UI show contextual messages ("Permission denied" vs "IndexedDB not available"). The Map type works naturally with `useSyncExternalStore` when fresh references are created on each notify.

### Decision 4: IndexedDB `storeName` auto-derived from `mountPath`

Default: `mountPath.replace(/^\//, 'zenfs-').replace(/\//g, '-')` (e.g., `/cache` → `zenfs-cache`). User can override with explicit `storeName` in the add form.

**Rationale**: Multiple IndexedDB mounts at different paths need separate databases. Auto-derivation prevents collisions by default with zero user friction. The `mountPath` uniqueness constraint already ensures no two mounts share a path.

### Decision 5: UI — backend type dropdown in the add form

```
Backend: [▼ File System Access]         ← new dropdown
Mount path [/epubs          ] [Add]    ← existing path input
```

When "IndexedDB" is selected, clicking "Add" creates the mount immediately (no picker). When "FSA" is selected, the existing `showDirectoryPicker()` flow runs.

Each mount row shows the backend type as a text label (e.g., "FSA" or "IndexedDB"). Only FSA rows show the reconnect button.

### Decision 6: No migration needed — normalize on read

`loadMounts()` (in `mount-store.ts`) normalizes entries: if `backend` is absent but `handle` exists, synthesize `{ kind: 'fsa', handle }`. This is done at the data-access layer so consumers (`zenfs.ts`, `use-zenfs.ts`) always see valid `BackendConfig`.

## Risks / Trade-offs

- **[Risk] Two IndexedDB mounts accidentally sharing a database**: Mitigated by auto-deriving `storeName` from `mountPath` + the existing mount-path uniqueness constraint.
- **[Risk] Service worker and frontend IndexedDB backends open the same database simultaneously**: ZenFS's `IndexedDB` backend uses `IDBDatabase` transactions internally. Testing should verify concurrent read/write scenarios don't deadlock.
- **[Risk] IndexedDB quota exceeded**: No explicit handling in this change. The ZenFS backend will throw an `ENOSPC` error, which surfaces naturally through the filesystem API. Future work could add quota monitoring.
- **[Trade-off] `handle` field kept on MountEntry**: Adds a deprecated field, but this is the simplest path to backward compatibility. Can be removed in a future major version.

## Open Questions

- **Should IndexedDB mounts allow explicit `storeName` in the UI?**: The data model supports it. Decision: omit from initial UI for simplicity — auto-derived names are sufficient. Can add a text field later.
- **Should the SW always use `_mountsDirty` reconfiguration for IndexedDB mounts?**: Currently the SW re-reads all mounts from IndexedDB when dirty. This works fine for IndexedDB too — the SW just re-opens the database. No special handling needed.