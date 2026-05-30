## Context

The EPUB storage layer exists in sketch form: `EpubCollection` type in `epub-lib/type.ts`, `ViewModel` class in `epub-lib/view-model.ts`, and a `epubzip.ts` placeholder for JSZip extraction. However:

- The `EpubCollection` mapped type is structurally broken (cannot distinguish collection names from unique identifiers at runtime — both are `string`)
- `ViewModel` imports the full `ZenFSState` interface but only needs the synchronous `fs` object
- `ViewModel` has TypeScript errors (invalid `readonly private` ordering) and unimplemented stubs
- No React UI exists for browsing/managing EPUB collections
- No route or tab for an EPUB explorer page

A new shadcn-tree-view component from the community registry will provide the tree UI. The existing shadcn `DropdownMenu` in `packages/ui` covers the action menus.

## Goals / Non-Goals

**Goals:**
- Provide a user-visible EPUB explorer as a persistent tab in the app shell
- Render the EPUB collection as a hierarchical tree, respecting directory nesting
- Support "Add Epub" (on collections) and "Delete Epub" (on EPUB items) via dropdown menu
- Support "From Directory" regeneration: scan ZenFS → rebuild `viewModel.json` → replace in-memory collection → notify UI
- Simplify `EpubCollection` to a clean recursive type
- Refactor `ViewModel` to accept raw `fs` instead of `ZenFSState`, fix TS errors

**Non-Goals:**
- EPUB parsing/rendering (the actual reader view) — that's the `/reader` route
- Drag-and-drop reordering in the tree
- Multiple selection
- Drag-and-drop file import onto the tree (future enhancement)

## Decisions

### Decision: Class-based ViewModel with subscriber pattern
- **Choice**: Keep `ViewModel` as a class with `subscribe()` / `notifyUpdate()` / `getCollectionSnapshot()`
- **Rationale**: Matches `useSyncExternalStore`'s expected API (`subscribe` + `getSnapshot`). The consumer wraps it via `useRef` for instance stability + `useSyncExternalStore` for reactivity. No cleanup needed from the ViewModel side — `subscribe()` returns an unsubscribe function that React calls.
- **Alternatives considered**: Zustand store — unnecessary overhead for a single-scope, single-instance store. Plain React state — would lose the benefit of the class encapsulating file I/O.

### Decision: ViewModel accepts raw `fs` object, not `ZenFSState`
- **Choice**: Constructor takes `appConfig: AppConfig` and `fs: typeof import("@/lib/zenfs").fs`
- **Rationale**: `ZenFSState` includes callbacks (`addMount`, `toggleMount`) and reactive state (`configured`, `mountedPaths`) that the ViewModel doesn't need. Passing only `fs` decouples the ViewModel from mount-state reactivity and avoids unnecessary re-creation when mounts change.
- **Alternatives considered**: Passing the full `useZenFS()` hook return — creates a fragile dependency on mount changes.

### Decision: EpubCollection type simplified
- **Choice**: `export type EpubCollection = { [key: string]: EpubCollection | IEpub }`
- **Rationale**: The previous mapped type tried to distinguish keys at the type level but `EpubCollectionName` and `EpubUniqueIdentifier` are both `string`, making the distinction meaningless at runtime. The recursive index signature correctly models a tree where each key is either a sub-collection or an EPUB metadata object.
- **Alternatives considered**: Discriminated union with a `type` field — adds complexity without runtime benefit since zenFS entries are self-describing by key naming convention.

### Decision: Tree display logic
- **Choice**: For a collection key → display the key as-is. For an EPUB node → display `title || uniqueIdentifier` as the tree node label. The `id` field of `TreeDataItem` uses `uniqueIdentifier` for epub leaves and the key name for collection nodes.
- **Rationale**: Collection names in ZenFS are user-visible directory names. EPUB titles are human-readable (falling back to the identifier if no title was extracted).
- **Alternatives considered**: Using `uniqueIdentifier` everywhere — loses the human-readable title in the UI.

### Decision: "From Directory" replaces both viewModel.json and in-memory state
- **Choice**: `getCollectionFromStorage()` scans ZenFS under `epub.zenFSPath`, building a fresh `EpubCollection` by reading directory structure and `*.epub.json` metadata files. It then writes this to `viewModel.json` and replaces the in-memory `this.collection`, followed by `notifyUpdate()`.
- **Rationale**: Ensures consistency between the persistent file and the live state. The scan is the source of truth; `viewModel.json` is a cache.
- **Alternatives considered**: Merging — risky when EPUBs were manually removed from the filesystem.

### Decision: Tree-view component installed in shared `packages/ui`
- **Choice**: `npx shadcn add "https://mrlightful.com/registry/tree-view"` targetting `packages/ui`
- **Rationale**: Pure presentational component with no app-specific dependencies. Makes it available to any future app in the monorepo.
- **Alternatives considered**: Installing in `apps/web` — works but is less reusable.

### Decision: `.epubdir` convention for unzipped content
- **Choice**: Store unzipped EPUB content in `<unique-identifier>.epubdir/` instead of the originally planned `<unique-identifier>/`.
- **Rationale**: The `.epubdir` suffix provides a deterministic, name-based way to distinguish EPUB content directories from user-created collection directories. The previous approach relied on the presence of a sibling `.epub.json` file, which was fragile — if the metadata file was deleted, the scanner would treat the content directory as a sub-collection.
- **Alternatives considered**: Keeping the old `<uid>/` convention with sibling `.epub.json` check — fragile when metadata files are missing.

### Decision: AddEpubsAt processes files independently with skip-on-error
- **Choice**: Each EPUB file is extracted and stored independently. If one fails, it is skipped, `console.warn` logged, and processing continues. A summary object is returned to the caller.
- **Rationale**: Don't lose all files because one is malformed. The caller can surface a UI alert about skipped files.
- **Alternatives considered**: Abort-all on first failure — loses valid files due to one bad one.

### Decision: DelEpubsAt removes from in-memory first, then filesystem
- **Choice**: Remove the EPUB entry from `this.collection` first, then delete the three sibling ZenFS artifacts (.epub, .epub.json, .epubdir/).
- **Rationale**: The in-memory collection is the ground truth — it was loaded from `viewModel.json` or regenerated from a scan. Deleting from it first avoids a situation where FS cleanup partially fails but the in-memory state is already correct. The delete paths are fully deterministic from the `epubId` and `collectionPath`, so no filesystem scan is needed.
- **Alternatives considered**: Scanning the filesystem to determine what to delete — redundant; the identifiers are already known.

### Decision: Add Epub via hidden `<input type="file">`
- **Choice**: A hidden `<input type="file" accept=".epub" multiple>` element in the page component, triggered programmatically from both the toolbar button and per-collection dropdown menu items.
- **Rationale**: Simple, works in all browsers, no extra dependencies. Drag-and-drop support can be added later.
- **Alternatives considered**: Drag-and-drop onto the tree — nicer UX but more complex, can be layered on later.

### Decision: New tab "epub" (lowercase) between Reader and Settings
- **Choice**: Add `{ value: "/epub", label: "epub" }` to the `TABS` array in `AppShell`, add `TabsContent` for it, add `/epub` to `SPA_ROUTES`, add `<Route>` in `App.tsx`.
- **Rationale**: Consistent with existing pattern. The app shell already syncs tabs to router location.

## Risks / Trade-offs

- [Scanning perf] `getCollectionFromStorage()` walks the ZenFS directory recursively. For very large collections (>1000 EPUBs), this could be slow. **Mitigation**: The operation is triggered manually ("From Directory" button), not on every render.
- [type instability] The recursive `EpubCollection` type makes it hard at the type level to know whether a value is a collection or an EPUB at a given key. **Mitigation**: Use a type guard `isEpub(value): value is IEpub` that checks for the `uniqueIdentifier` property.
- [ViewModel instantiation] Creating the ViewModel requires `fs` to be available (ZenFS configured). If the page loads before configuration, the component tree must handle the "not configured" state gracefully. **Mitigation**: The EPUB explorer page checks `zenfs.configured` and shows a placeholder, mirroring the File Explorer pattern.