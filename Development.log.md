# Development Log

## 2026-05-31 — Multi-backend ZenFS mounting with IndexedDB support

### Done

- **Added `BackendConfig` discriminated union** (`FsaConfig` | `IndexedDBConfig`) to `mount-store.ts` to generalize backend types beyond the hard-coded `WebAccess`.
- **Created `lib/backend-resolver.ts`** — shared module with `resolveBackendConfig()` that maps `BackendConfig` → ZenFS mount config. Only module importing backend implementations (`WebAccess`, `IndexedDB`) from `@zenfs/dom`.
- **Refactored `lib/zenfs.ts`** — removed direct `WebAccess` import, uses `resolveBackendConfig()` for all mounts; refactored `skippedIds` (Set) → `deniedEntries` (Map<string, string>) with reason strings for backend-aware error displays.
- **Refactored `sw-routes/zenfs-sw.ts`** — uses `resolveBackendConfig()` instead of hardcoded `WebAccess`; mount-key tracking now includes backend kind (`mountPath::kind`) for change detection.
- **Updated `hooks/use-zenfs.ts`** — `ZenFSState.deniedEntries` is now `ReadonlyMap<string, string>` instead of `skippedIds: string[]`.
- **Updated `components/layout/mounts-dialog.tsx`** — added backend type dropdown (File System Access / IndexedDB) in the add form; conditional flow (FSA shows directory picker, IndexedDB creates immediately); mount rows show backend type label ("FSA" / "IndexedDB"); reconnect button only for FSA denied entries.
- **Updated `components/layout/app-shell.tsx`** — startup mount validation now uses `mountBackend()` + `BackendValidationError` instead of separate `queryHandlePermission()` + `markSkipped()`.
- **Backward compatibility**: `MountEntry.handle` is now optional/deprecated; `normalizeMountEntry()` synthesizes `backend: { kind: 'fsa', handle }` for legacy entries; `loadMounts()` normalizes on read; `saveMount()` still writes `handle` for old code paths.
- **IndexedDB store name**: auto-derived from mount path via `storeNameFromPath()` (e.g., `/cache` → `zenfs-cache`).

### Design decisions

- **Discriminated union over strategy pattern** — chosen because it's simpler for 2 backends, gives exhaustive TypeScript checking, and IndexedDB stores it naturally. Can evolve to strategy pattern at 4+ backends.
- **Shared resolver module** — `lib/backend-resolver.ts` is imported by both frontend and SW to prevent divergence. Only this module touches backend implementations.
- **Mount key includes backend kind in SW** — `_prevMountKeys` uses `"mountPath::kind"` format so switching an FSA mount to IndexedDB at the same path is detected as a change.
- **IndexedDB reconnect is no-op**: no permission prompts needed, just a remount attempt.

### Inconsistency of documentation

- `openspec/specs/mount-management/spec.md` and `openspec/specs/zenfs-integration/spec.md` still describe WebAccess-only behavior. Delta specs created in this change cover the new multi-backend requirements.

## 2026-05-30 — Rewrote public-facing README.md

### Done

- **Replaced the minimal README** with a comprehensive, visually appealing project README including: centered header badge with project name, tagline ("Read. Offline. Anywhere."), feature grid (6 features in a 2×3 table), quick start guide with post-install steps, ASCII architecture diagram showing browser layers (React ↔ SW → ZenFS → IndexedDB), technology stack table, EPUB pipeline walkthrough, development commands, project structure overview, roadmap checklist, and tech stack badges.

### Design decisions

- **Used feature grid instead of bullet list** — a 2×3 table with emoji headers gives the page visual rhythm and makes each feature scannable.
- **Included architecture ASCII diagram** — since Exstudeo's unique value is its offline/local-first architecture, showing the browser-internal layers (React app shell, Service Worker, ZenFS, IndexedDB) communicates this visually.
- **EPUB pipeline section** — explains the upload-time parsing → SW interception → WASM HTML rewrite → client-side viewer flow in 4 simple steps.
- **Roadmap section** — signals ambition (Markdown, search, knowledge graph, plugins, sync) without overpromising.
- **Tech stack badges** — standard open-source visual cue at the bottom of the dev section.

## 2026-05-31 — Refactor useZenFS to useZenFSSnapshot with standalone mutator functions

### Done

- **Extracted standalone mutator functions** (`addMountEntry`, `toggleMountEntry`, `removeMountEntry`, `reconnectMountEntry`) into `lib/zenfs.ts`. Each combines `mount-store` persistence + ZenFS operations + `notify()` — the same logic previously in `use-zenfs.ts` callbacks. Added TSDoc for all four.
- **Renamed `useZenFS` → `useZenFSSnapshot`** — hook now returns only `{ entries, deniedEntries, hasEntries }` wrapped in `useMemo` for reference stability. `fs`, `promises`, and mutator callbacks removed from return type. Old `useZenFS` kept as `@deprecated` alias.
- **Renamed `ZenFSState` → `ZenFSSnapshot`** — interface shrunk to read-only reactive state only.
- **Simplified `MountsDialog` props** from `Pick<ZenFSState, ...>` to `{ entries, deniedEntries }`. Removed the `useEffect(() => {}, [zenfs.entries])` force-re-render anti-pattern (replaced by `useMemo` in hook). `AddMountForm` now uses unified `addMountEntry()` instead of ad-hoc `persistMount` + `mountBackend`.
- **Updated page consumers**: `FileExplorerPage` imports `{ promises }` from `@/lib/zenfs` directly instead of `zenfs.fs.promises`. `EpubExplorerPage` passes `promises` directly to `EpubContextProvider`.

### Design decisions

- **Why standalone mutators in `lib/zenfs.ts`?** The hook was a thin wrapper over non-React logic. `AddMountForm` already bypassed the hook's `addMount` — this unified both call sites.
- **Why `useMemo`?** `useSyncExternalStore` triggers re-renders, but the returned object should be reference-stable across renders when state hasn't changed. This replaces the `MountsDialog` force-rerender hack.
- **Why `fs`/`promises` removed from hook?** They're immutable global singletons from `@zenfs/core`. Passing them through the hook misleadingly implied the hook owned them.
- **Why keep `@deprecated useZenFS` alias?** Smooth migration path — no crashes for any uncaught references.

### Verification

- `tsc --noEmit`: clean
- `vitest --run`: 6/6 passed (2 files)
- `npm run build`: clean (both Vite and SW)

## 2026-05-30 — EPUB viewer sidebar TOC scrolls to current chapter

### Done

- **Added `scrollIntoView` in `highlightCurrentChapter()`** (`epub-viewer.ts`) — after adding the `ex-current` class, the found anchor is scrolled to the center of the sidebar viewport with `{ block: "center", behavior: "instant" }`. This ensures the sidebar TOC always tracks the current reading position on page navigation, without animation flash since it's a full page reload anyway.

## 2026-05-30 — Fix React Fast Refresh warning for epub-context.tsx

### Done

- **Changed `EpubContextProvider` from named to default export** in `epub-context.tsx`. React Fast Refresh can't handle files that export both a component and a hook as named exports. Having the component as `export default` and the hook as a named export resolves the HMR warning "Could not Fast Refresh (`useEpubContext` export is incompatible)".
- Updated the import in `page.tsx` from `{ EpubContextProvider, useEpubContext }` → `EpubContextProvider, { useEpubContext }`.

## 2026-05-30 — Fix NCX TOC parsing: case-sensitive tagName comparison

### Done

- **Fixed `walkNcxNavPoints` and `getNavPointDepth` in `book-parser.ts`** — The NCX `tagName` comparison used `=== "NAVPOINT"` but XML DOM preserves the original case from the source document (`"navPoint"`). Changed to `tagName.toUpperCase() === "NAVPOINT"` in both the TreeWalker filter and `getNavPointDepth`. This caused the TreeWalker to never accept any nodes, returning an empty TOC for all EPUB 2 (NCX) books.

## 2026-05-30 — Sticky EPUB viewer sidebar on desktop

### Done

- **Added `align-self: start` to `.ex-sidebar`** in `epub-style.css`. CSS Grid's default `align-items: stretch` forces grid children to match the row height (dominated by `.ex-content`), which defeats `position: sticky`. Setting `align-self: start` lets the sidebar keep its natural `height: 100vh` so `position: sticky; top: 0` pins it to the viewport while the content column scrolls independently. Single property, no other changes needed. Mobile behavior unaffected (uses `position: fixed` already).

## 2026-05-30 — Clickable EPUB book links in EPUB Explorer

### Done

- **Extracted `sanitizeFilename` to `lib/epub-lib/utils.ts`** — Moved the function and `FSA_INVALID_CHARS` regex from `view-model.ts` into a new shared utility module. This makes the sanitizer available to components that need to construct epubdir URLs from raw `uniqueIdentifier` values. Updated `view-model.ts` to import from `./utils`.

- **Added `onBookOpen` callback through `epub-tree`** — Extended `EpubTreeProps` with optional `onBookOpen(epubId, collectionPath)` prop. Wired it through `collectionToTreeData()` (new parameter), which sets `onClick` on EPUB leaf `TreeDataItem` nodes. Propagated through recursive collection calls.

- **Implemented URL construction in `page.tsx`** — Added `onBookOpen` handler in `EpubExplorerContent`: sanitizes the identifier, builds URL `/@epubs/{collectionPath/}{safeId}.epubdir/sidebar.html`, opens via `window.open(url, "_blank", "noopener,noreferrer")`. Handles root-level and sub-collection paths.

### Design decisions

- **Why not `IEpub.epubdirPath`?** Adding the sanitized path to `IEpub` would require migration for existing `viewModel.json`. Callback approach avoids data model changes.
- **Why `window.open` not `<a>`?** `TreeView` renders via `TreeLeaf` component using `div` with `onClick`. The callback pattern matches how `DirectoryTable` handles clickable entries.
- **Clean import in view-model.ts** — Removed duplicated `FSA_INVALID_CHARS` regex and local `sanitizeFilename`, replaced with import from `./utils`. Typecheck: clean.

## 2026-05-30 — Implement EPUB Viewer (HTML Rewrite Pipeline + Book Parser + Viewer Script + CSS)

### Done

- **Installed `html-rewriter-wasm`** — lol-html WASM for streaming HTML transformation in the service worker. Also tried `@worker-tools/html-rewriter` but it auto-fetches WASM at construction which is problematic for bundling.
- **Configured Vite multi-entry build** — `src/viewer/epub-viewer.ts` builds to `dist/epub-assets/epub-viewer.js` (3.87 KB minified). Stable filename (no hash) so the SW can inject via fixed path.
- **HTML Rewrite Pipeline** (`src/sw-routes/html-rewrite/`):
  - `types.ts` — `HtmlTransformStrategy` interface (name, shouldApply, apply) + `EpubPageContext` + `SelectorHandlers`
  - `handle.ts` — `HtmlTransformHandleImpl` wrapping `html-rewriter-wasm` HTMLRewriter with `on(selector, handlers)` API
  - `pipeline.ts` — `HtmlRewritePipeline` composes strategies in order, streams bytes through, concatenates output chunks
  - `strategies.ts` — `SanitizeStrategy` (strips scripts, styles, inline style/event handlers, publisher stylesheet hrefs), `InjectStylesStrategy` (appends viewer CSS link to head), `InjectViewerStrategy` (appends viewer JS module to body), `defaultEpubPipeline()` factory
- **Book Structure Parser** (`src/lib/epub-lib/book-parser.ts`):
  - `parseSpine()` — querySelectorAll on OPF `<spine><itemref>`, resolves href from manifest
  - `parseTocNav()` — EPUB 3 NAV: querySelector `nav[epub:type="toc"] ol`, recursively walks `<li><a><ol>`
  - `parseTocNcx()` — EPUB 2 NCX: TreeWalker over `navMap > navPoint` with depth tracking for nested sections
  - `generateSidebarHtml()` — emits `<nav class="ex-toc"><ol><li><a href="...">` with `<details open>` for collapsible sections
  - `parseBookStructure()` — main entry point: dispatches spine + TOC parsers, resolves NCX/NAV from OPF, returns `BookStructure { spine, toc, sidebarHtml }`
  - Graceful handling: missing NCX/NAV → empty TOC with placeholder sidebar
- **epub-style.css** — Responsive two-column grid layout (sidebar 280px + content), reading typography (serif, 16px, line-height 1.7, max-width 65ch), TOC styles with collapsible `<details>`, mobile slide-in drawer at <768px, dark mode via `prefers-color-scheme`, publisher CSS reset
- **epub-viewer.ts** — Client-side viewer script:
  - `getEpubdirBaseUrl()` — extracts `.epubdir/` prefix from `location.href`
  - `rewriteSidebarLinks()` — resolves relative sidebar hrefs to absolute via `new URL(href, baseUrl)`
  - `resolvePageName()` — 4-tier priority: TOC match → h1 → existing title → filename
  - `setPageTitle()` — sets `document.title` and `og:title` meta tag
  - `injectSidebar()` — fetches `sidebar.html`, parses, rewrites links, wraps original content in `<main class="ex-content">`, creates sidebar toggle + overlay
  - `highlightCurrentChapter()` — adds `ex-current` class to matching sidebar links
  - `wireSidebarToggle()` — mobile hamburger button + overlay + Escape key handling
  - Error handling: all fetches guarded with try/catch, graceful fallbacks for missing files
- **SW EPUB Route integration** — `epub.ts` now runs `HtmlRewritePipeline` with `defaultEpubPipeline()` on HTML/XHTML responses before returning. Non-HTML (images, fonts, CSS, JSON) skip the pipeline. `isHtmlContentType()` checks for `text/html` or `application/xhtml+xml`.
- **ViewModel integration** — `AddEpubsExtracted` now calls `parseBookStructure()` before writing files. `_persistEpubDir` writes `spine.json`, `toc.json`, `sidebar.html` alongside `book.epub` and `book.json`. Parse failures are treated as extraction failures with cleanup and reporting.

### Files Changed

| File | Changes |
|------|---------|
| `apps/web/package.json` | Added `html-rewriter-wasm` and `@worker-tools/html-rewriter` dev dependencies |
| `apps/web/vite.config.ts` | Multi-entry build: `epub-assets/epub-viewer` → `src/viewer/epub-viewer.ts`, stable output filename |
| `src/sw-routes/html-rewrite/types.ts` | NEW: `HtmlTransformStrategy`, `EpubPageContext`, `HtmlTransformHandle`, `SelectorHandlers` |
| `src/sw-routes/html-rewrite/handle.ts` | NEW: `HtmlTransformHandleImpl` wrapping `html-rewriter-wasm` HTMLRewriter |
| `src/sw-routes/html-rewrite/pipeline.ts` | NEW: `HtmlRewritePipeline` composes strategies, `concatChunks` helper |
| `src/sw-routes/html-rewrite/strategies.ts` | NEW: `SanitizeStrategy`, `InjectStylesStrategy`, `InjectViewerStrategy`, `defaultEpubPipeline()` |
| `src/sw-routes/html-rewrite/index.ts` | NEW: Barrel export |
| `src/sw-routes/html-rewrite/html-rewrite.test.ts` | NEW: 15 tests covering XHTML compat, sanitization, pipeline ordering |
| `src/viewer/epub-viewer.ts` | NEW: Full client-side viewer script (329 lines) |
| `src/lib/epub-lib/book-parser.ts` | NEW: Spine/TOC parsing, sidebar HTML generation (435 lines) |
| `public/epub-assets/epub-style.css` | Filled in: responsive layout, typography, TOC styles, dark mode, mobile drawer |
| `src/sw-routes/epub.ts` | Added HTML rewrite pipeline integration + `isHtmlContentType()` helper |
| `src/lib/epub-lib/view-model.ts` | Imported `parseBookStructure`, updated `AddEpubsExtracted` and `_persistEpubDir` |

### Design Decisions

- **Used `html-rewriter-wasm` directly** instead of `@worker-tools/html-rewriter` — the latter auto-fetches WASM at construction via `fetch()`, which complicates bundling and doesn't work in Node/Vitest. `html-rewriter-wasm` provides the same lol-html engine with explicit output sink.
- **Streaming API** (`write`/`end`) rather than `transform(Response)` — gives full control over input/output bytes and makes testing straightforward.
- **`HtmlTransformHandleImpl` wraps the low-level API** — strategies only see `on(selector, handlers)`, not raw HTMLRewriter. This abstraction makes strategies portable and testable.
- **PIPELINE ERROR HANDLING**: HTML rewrite failures in the SW are caught and the original (untransformed) content is served. This is a graceful degradation — the user sees raw content rather than a 404.
- **Sidebar links use path-relative hrefs + client-side rewriting** — NOT `<base>` element. Ensures publisher `<img src="images/foo.png">` in `OEBPS/ch01.xhtml` resolves to `OEBPS/images/foo.png` (correct) instead of `images/foo.png` (wrong).
- **Book structure parsed at upload time** — not on-demand during read. Since uploads are rare relative to reads, pre-computing is a clear win for read performance.
- **No Node.js dependencies in viewer script** — only uses `fetch`, `DOMParser`, `URL`, and DOM APIs. Fully browser-compatible.

### Validation

- Typecheck: clean
- Unit tests: 21/21 pass (15 new html-rewrite tests + 3 utils + 3 theme-provider)
- Build: succeeds, `dist/epub-assets/epub-viewer.js` (3.87 KB), SW with 19 precached entries

### Remaining Manual E2E

- [ ] 11.1 Upload EPUB → verify spine.json/toc.json/sidebar.html exist
- [ ] 11.2 View EPUB chapter → sidebar + content layout
- [ ] 11.3-11.7 Various viewer behaviors (title, TOC links, highlighting, mobile)

---

## 2026-05-29 — Refactor EPUB Storage Convention (self-contained `.epubdir/`)

### Done

- **Moved all EPUB artifacts inside `.epubdir/`** — `_persistEpubDir` now writes `book.epub`, `book.json`, and all unzipped content into the single `.epubdir` directory. No sibling files (`.epub`, `.epub.json`) remain at the collection level.
- **Updated `AddEpubsExtracted`** — creates `<safeId>.epubdir/`, calls the refactored `_persistEpubDir` with the epubdir path + file buffer + metadata + entries. Failure cleanup uses single `rmdir`.
- **Updated `DelEpubsAt`** — single `rmdir(<safeId>.epubdir/)` replaces the three separate unlink/rmdir calls.
- **Updated `_scanDir`** — enters `.epubdir` directories to read `book.json` (instead of looking for sibling `.epub.json` files). Uses `metadata.uniqueIdentifier` as the collection key. Does NOT recurse into `.epubdir`.
- **Updated file header docblock** to reflect the new self-contained convention.

### Files Changed

| File | Changes |
|------|---------|
| `src/lib/epub-lib/view-model.ts` | Rewrote `_persistEpubDir` signature and body, updated `AddEpubsExtracted` write + cleanup, updated `DelEpubsAt` to single `rmdir`, rewrote `_scanDir` to enter `.epubdir` and read `book.json`, updated TSDoc |

### Design Decisions

- **Fixed internal names** (`book.epub`, `book.json`) — the directory name already carries the sanitized identifier, so internal filenames can be predictable constants. This eliminates the need to reconstruct the safeId when reading.
- **BREAKING: No migration** — old sibling-file format is silently lost. Project is pre-release with no real user data. The `viewModel.json` will also be invalidated.
- **`IEpub.OpfPath` unchanged** — the OPF path is relative to the EPUB archive root, which matches the `.epubdir/` root after extraction. No re-basing needed.
- **`EpubCollection` keys unchanged** — still `uniqueIdentifier` from metadata, not the directory name.

### Validation

- Typecheck: clean
- Unit tests: 6/6 pass
- Manual testing (tasks 6.2, 6.3): pending — need running dev server

## 2026-05-29 — EPUB Explorer: Create Collection Feature

### Done

- **Added `CreateCollection(name, parentPath)` to ViewModel** — validates name (non-empty, no `.epubdir` suffix, no duplicate), creates ZenFS directory via `promisesFs.mkdir`, inserts `{}` into in-memory collection, persists `viewModel.json` via serialized write queue, notifies subscribers. FS-first consistency: if `mkdir` fails, in-memory is never mutated.
- **Added "Create Collection" toolbar button** in `page.tsx` — uses `FolderPlusIcon`, located before "Add Epub", calls `onCreateCollection([])` at root level.
- **Added "Create Subcollection" dropdown item** in `epub-tree.tsx` — added to `CollectionActions` between "Add Epub" and "Remove Collection", wired via new `onCreateCollection` prop on `EpubTreeProps`.
- **`window.prompt()` for name input** — consistent with existing `window.confirm()` pattern in the same file. Validation errors shown via `alert()`.

### Design Decisions
- **FS-first consistency**: `mkdir` happens before any in-memory mutation. If it fails, nothing is touched. If it succeeds but `viewModel.json` write later fails, in-memory is still updated and UI reflects the change (same pattern as all other mutations).
- **Sanitize FS directory name** via `sanitizeFilename()` but keep original name as collection key — matches EPUB naming convention.
- **Rejects `.epubdir` suffix** to prevent collision with EPUB content directories.

## 2026-05-29 — Fix BreadcrumbSeparator invalid `<li>` nesting

### Done

- **Changed `BreadcrumbSeparator` from `<li>` to `<span>`** in `packages/ui/src/components/breadcrumb.tsx` — the separator was rendered as a `<li>` but was placed inside `BreadcrumbItem` (also a `<li>`), causing a React hydration error (`<li>` cannot be a descendant of `<li>`). Since the separator is a presentational icon element, `<span>` with `role="presentation"` is the correct semantic choice.

## 2026-05-29 — Remove Sync ZenFS API & `configure()` Guard

### Done

- **Eliminated all sync `fs.*` calls** from the frontend codebase:
  - `fs.readdirSync`, `fs.statSync`, `fs.readFileSync`, `fs.writeFileSync` — all converted to `promises.*` equivalents
  - `getMountedPaths()` converted from sync `readdirSync` to async `promises.readdir`, now returns `Promise<string[]>`
- **Removed `configure()` function** from `lib/zenfs.ts` — ZenFS supports dynamic mount/unmount at runtime via `mountBackend()` without needing pre-configuration
- **Removed `_configured` flag** and `isConfigured()` export — the singleton no longer tracks a "configured" state
- **Removed `configured` from reactive snapshot** — replaced with `hasEntries` (derived from `entries.length > 0`)
- **ViewModel constructor made purely synchronous** — storage reads moved to async `init()` method
- **ViewModel storage reads converted to promises API** — `getCollectionFromStorage()`, `getCollectionFromviewModelFile()`, `_scanDir()` all now async

#### Changes by file

| File | Changes |
|------|---------|
| `src/lib/zenfs.ts` | Removed `configure()`, `_configured`, `isConfigured()`; removed `configured` from snapshot; removed `_configured` guard from `mountBackend()`/`unmountBackend()`; converted `getMountedPaths()` to async with `promises.readdir` |
| `src/hooks/use-zenfs.ts` | Replaced `configured` with `hasEntries` in `ZenFSState` |
| `src/components/layout/app-shell.tsx` | Removed `configure`/`isConfigured` imports; each valid mount entry now mounted individually via `mountBackend()` instead of bulk `configure()` |
| `src/components/file-explorer/page.tsx` | `!zenfs.configured` → `!zenfs.hasEntries` + dependency array fix |
| `src/components/epub-explorer/page.tsx` | `!zenfs.configured` → `!zenfs.hasEntries`; only passes `promises` to `EpubContextProvider` |
| `src/components/epub-explorer/epub-context.tsx` | Removed `fs` prop; ViewModel created with only `promises`; `init()` called in `useEffect` with loading state |
| `src/lib/epub-lib/view-model.ts` | Removed `fs` parameter; `_scanDir`/`getCollectionFromStorage`/`getCollectionFromviewModelFile`/`updateViewModelFile` all async; constructor synchronous with async `init()` |

### Design Decisions
- **`configured` → `hasEntries`**: Equivalent heuristic — before, "configured" meant "has at least one mount entry". Now it's explicit.
- **Constructor stays synchronous**: The ViewModel is created in `useRef` (render phase). All FS reads move to async `init()`, called in `useEffect`. The `useSyncExternalStore` subscription re-renders the UI when init completes.
- **Dynamic mount without configure**: `mountBackend()` now calls `resolveMountConfig()` + `zenfsMount()` directly, which works fine without a prior `configure()` call. ZenFS defaults to an `InMemory` backend at `/`.
- **SW unchanged**: `zenfs-sw.ts` still uses its own `configure()` internally — that's an independent ZenFS instance running in the worker context with different lifecycle needs.**

## 2026-05-28 — ViewModel Three-Part Fix: Sanitize + Promises + Write Queue

### Done

- Fixed 5 EPUB explorer bugs caused by ZenFS sync wrappers silently swallowing FSA errors and concurrent writes corrupting `viewModel.json`.

#### Root Causes
1. **FSA rejects `:` in filenames**: EPUB `uniqueIdentifier` values like `urn:uuid:...` and `urn:isbn:...` contain colons. FSA throws "Name is not allowed", but ZenFS sync wrappers turn these into unhandled promise rejections instead of thrown exceptions.
2. **No write serialization**: Rapid in-memory deletion + `updateViewModelFile` calls interleaved their async FSA writes, producing malformed JSON (e.g., `}` followed by next key on same line).

#### Changes — `view-model.ts`
- **Part 1 — Sanitize filenames**: Added `sanitizeFilename()` helper that replaces FSA-forbidden characters (`: \ / ? " < > |`) with `_`. Used for all ZenFS paths; in-memory collection keys retain original `uniqueIdentifier`.
- **Part 2 — Promises API for mutations**: Converted `AddEpubsExtracted`, `DelEpubsAt`, `DelCollection`, `_persistEpubDir`, and `_rmdir` from sync (`fs.*Sync`) to async (`promises.*`). FSA errors now propagate correctly as rejected promises instead of silent failures.
- **Part 3 — Serialized write queue**: Added `_writeQueue: Promise<void>` chain for `viewModel.json` writes. Each mutation chains its write onto the previous one, preventing interleaved writes. Queue stays alive across individual write failures.
- **All-or-nothing per EPUB**: `AddEpubsExtracted` only updates the in-memory collection if ALL three FS artifacts (`.epub`, `.epub.json`, `.epubdir/`) are written successfully. Partial artifacts are cleaned up on failure.
- **Removed dead code**: Deleted `_rmdirSync` (replaced by async `_rmdir`). Kept static `updateViewModelFile` (still used during sync constructor initialization).

#### Changes — `epub-context.tsx`
- Added `promises` prop to `EpubContextProvider` (type `typeof ZenFSPromises`).
- Passes `promises` as third argument to `new ViewModel(appConfig, fs, promisesFs)`.

#### Changes — `page.tsx` (EPUB explorer)
- `handleFilesSelected`: `await` on `viewModel.AddEpubsExtracted()`.
- `onDeleteEpub`: Now `async` with try/catch, `await viewModel.DelEpubsAt()`.
- `onDeleteCollection`: Now `async` with try/catch, `await viewModel.DelCollection()`.
- Passes `zenfs.promises` as the `promises` prop to `EpubContextProvider`.

#### Changes — `add-from-dir.tsx`
- `handleClick` is now `async` with try/catch, `await viewModel.regenerateFromDirectory()`.

### Design Decisions
- **Sanitize with `_` not `_`**: Chosen for maximum visibility during debugging.
- **Constructor stays sync**: Initial reads use the sync API (safe — no concurrent writers during boot).
- **Write queue over mutex**: A simple promise chain avoids lock complexity. Errors don't break the queue (`_writeQueue` is kept alive via `.catch(() => {})`), so subsequent mutations always write.
- **file-explorer left sync**: Read-only component with no mutations — sync reads are safe and don't need conversion.

## 2026-05-29 — File Explorer Converted to Async Promises API

### Done

- Converted `FileExplorerPage` from synchronous `useMemo` + `readdirSync`/`statSync` to async `useEffect` + `zenfs.fs.promises.readdir`/`promises.stat`.
- Replaced `useMemo` with `useEffect` + `useState` (`entries`) to accommodate async loading.
- Added a `loadRef` (incrementing counter) as a guard against async data races — stale responses from a previous navigation are discarded.
- Removed unused `useMemo` import.

## 2026-05-28 — Fix JSON Corruption and UI Stale State

### Done

- Fixed two follow-up bugs in the ViewModel after the three-part fix.

#### Bug 1 — JSON corruption on shrink
**Root cause**: ZenFS `promises.writeFile` with flag `'w'` on the WebAccess/FSA backend doesn't reliably truncate existing files. When the collection shrank (e.g., `{}` after deleting entries), the old larger content remained after the new shorter content — producing malformed JSON like `{}  "TSN...": { ... } }` (the `}` closes the empty object, then old data follows).
**Fix**: `_writeViewModelFile` now does `unlink` before `writeFile` — deleting the old file first guarantees clean truncation regardless of backend behavior. The unlink is best-effort (file may not exist yet).

#### Bug 2 — UI not updating after failed write
**Root cause**: If `_writeViewModelFile` rejected (write failure), `await` threw before `notifyUpdate()` was called. The in-memory collection was already mutated, but React never re-rendered the UI.
**Fix**: All mutation methods now wrap `_writeViewModelFile` in try/catch — `notifyUpdate()` is always called regardless of write success. Warnings are logged on failure.

#### Bug 3 — SW serves stale file data after frontend mutations
**Root cause**: The Service Worker and the frontend each have their own independent ZenFS instance with separate inode tables. When the frontend deletes+rewrites `viewModel.json` (or any file under a mounted backend), the SW's ZenFS still holds the old file mapping and throws `"Unexpected mismatch in file data size"` on the next request.
**Fix — Two changes**:
1. **SW `ensureZenFS()` always reconfigures when dirty** (removed the mount-hash skip). Previously if `_mountsDirty` was set but the mount entry list hadn't changed, the function returned early without reconfiguring — the stale inode table survived. Now it always calls `zenfsConfigure()` on dirty, creating fresh inode tables from FSA handles.
2. **ViewModel notifies SW after `viewModel.json` writes**: `_writeViewModelFile` calls `notifyServiceWorker()` after successfully writing. This posts `{ type: "zenfs-reload" }` to the SW controller, which sets `_mountsDirty = true`, ensuring the next SW-served request gets fresh data.
- Removed dead `_mountsHash` and `computeHash()` from `zenfs-sw.ts`.

## 2026-05-25 — Project Scaffold

### Done

- Initialized monorepo via `npx shadcn@latest init --preset b0 --base base --template vite --monorepo --rtl`
- Installed `shadcn/ui` agent skill (`.agents/skills/shadcn/`)
- Installed OpenSpec workflow skills (`.github/skills/openspec-*/`)
- Created agent framework documentation:
  - `AGENTS.md` — agent instructions and codemap
  - `README.md` — public project readme
  - `dev.readme.md` — developer reference with architecture and conventions
  - `Development.log.md` — this log
  - `apps/web/AGENTS.md` — web app agent instructions
  - `apps/web/readme.md` — web app developer docs
  - `packages/ui/AGENTS.md` — UI package agent instructions
  - `packages/ui/readme.md` — UI package developer docs
- Populated `openspec/config.yaml` with project context for spec generation
- Created `used_doc/` directory for reference documentation

### Notes

- Project uses npm workspaces (not pnpm) despite shadcn CLI default — `packageManager` in root `package.json` reflects this.

## 2026-05-27 — SPA SW Route Handler (offline fix)

### Done

- Fixed offline blank page when refreshing at `/files`, `/reader`, `/settings`.

## 2026-05-27 — FSA Handle Permission Recovery After Browser Restart

### Done

- Identified root cause: after browser restart, `FileSystemDirectoryHandle` objects persisted in IndexedDB lose their permission grant. The app passed them directly to `@zenfs/core` which threw `NotAllowedError`.
- Fixed permission-aware startup in `app-shell.tsx`:
  - After loading mount entries from IndexedDB, calls `queryHandlePermission` on each mounted entry.
  - Entries with revoked permissions are tracked via `markSkipped()` and filtered out of the `configure()` call.
  - Valid entries are mounted normally — the app loads without crashing.
- Extended `zenfs.ts` reactive state:
  - Added `_skippedIds: Set<string>` tracking which entries were skipped.
  - Added `deniedIds: string[]` to the snapshot for the React hook.
  - Added `markSkipped()`, `clearSkipped()`, and `reconnectMount()` functions.
- Exposed new state and actions via `use-zenfs.ts` hook:
  - `skippedIds: string[]` — IDs of entries needing reconnection.
  - `reconnectMount(id)` — requests permission from user and mounts on success.
- Added Reconnect UI in `mounts-dialog.tsx`:
  - Skipped entries show an amber warning banner with AlertTriangle icon.
  - "Reconnect" button calls `reconnectMount()` which triggers the browser permission prompt.
  - Shows spinner while connecting and error message if denied.
  - On success, the entry reverts to normal mounted state.
- Added SW resilience in `zenfs-sw.ts`:
  - Wrapped `zenfsConfigure` in try-catch to avoid crashing on permission failures.
  - Marks as unconfigured + dirty so retry happens on next request.

### Design Decisions

- **No auto-reprompt**: User-initiated reconnect via UI button (per user preference).
- **SW relies on frontend**: SW doesn't verify permissions independently. Frontend's successful reconnect triggers `zenfs-reload` postMessage.
- **No IDB schema change**: Skipped state is in-memory only, refreshed on every page load.
- **queryPermission** (not `requestPermission`) on startup: ensures no unexpected prompts during initial load.

## 2026-05-27 — File Explorer Not Updating After Mount

### Done

- Fixed stale file listing in `FileExplorerPage` when mounts changed at runtime.
- **Root cause**: `useMemo` dependency array `[zenfs.configured, currentPath, zenfs.fs, config]` didn't include `zenfs.mountedPaths`. After mounts changed, `configured` stayed `true`, `fs` object was same reference, `currentPath` unchanged → `useMemo` returned a frozen stale result.
- **Fix**: Added `zenfs.mountedPaths` to the dependency array. The `mountedPaths` array changes on every mount/unmount via `notify()` which re-reads `readdirSync("/")`.
- **Root cause**: `Response.redirect()` in the SW is unreliable offline in Chromium — the redirect target may fail to render, resulting in a blank page.
- **Fix**: SPA route handler now calls `matchPrecache("/")` to serve the precached app shell directly, keeping the original URL intact. React Router reads the address bar and renders the correct page. Falls back to `Response.redirect()` only when the precached root isn't available.
- Updated `isUnknownNavigation` comment to reflect "SPA route handler" (was "SPA redirect handler").
- Updated `RedirectHandler` TSDoc in `App.tsx` — now only documents cold-visit path (404.html), since the SW no longer uses redirect params.

### Design Decisions

- **matchPrecache("/")** instead of NavigationRoute or setDefaultHandler: minimal change, reuses existing precached content, only affects the SPA route handler. No new route infrastructure needed.

## 2026-05-31 — Archive operations for OpenSpec changes

### Actions

- Archived change `refactor-zenfs-hook` → `openspec/changes/archive/2026-05-31-refactor-zenfs-hook/` after syncing delta specs into `zenfs-integration`.
- Attempted to archive `implement-epub-viewer` but target archive `openspec/changes/archive/2026-05-31-implement-epub-viewer/` already exists; archive of that change was not performed.

### Notes

- The `refactor-zenfs-hook` delta added the `useZenFSSnapshot` hook requirement and standalone mutator functions; these were integrated into `openspec/specs/zenfs-integration/spec.md` before archiving.
- `implement-epub-viewer` had incomplete artifacts (design, specs) but user confirmed archival; operation failed due to existing archive directory — please resolve the existing archive (rename/delete) or choose a different archive date and retry.
- **Fallback kept**: If the precached root is somehow unavailable (unlikely with injectManifest), the old redirect behavior still works.

## 2026-05-26 — SW Routing Fix

### Done

- Created `apps/web/src/route.path.ts` — shared source of truth for SPA routes (`/files`, `/reader`) with `as const` assertion and TSDoc
- Updated `App.tsx` to import `SPA_ROUTES` and derive `<Route path>` props; added `RedirectHandler` component for `?redirect=`/`?fragment=` on boot
- Created `apps/web/src/lib/redirect-handler.ts` — parses redirect params, matches against SPA_ROUTES, returns target path
- Rewrote `public/404.html` — inline JS captures `location.pathname+search+hash`, redirects to `/?redirect=...&fragment=...` with `<noscript>` meta-refresh fallback
- Created `apps/web/src/sw-templates/` directory with `sw-not-found.html` and `sw-validate.html` (using `{{key}}` placeholders)
- Rewrote `src/sw.ts` three-tier routing:
  1. SPA redirect handler (startsWith matching → 302 to `/?redirect=...&fragment=`)
  2. Validation page handler (diagnostic JSON dump at `/validate_service_worker.html`)
  3. 404 catch-all for unknown routes (renders `sw-not-found.html`)
- All handlers gated behind `manifest.length > 0` guard; old flat NavigationRoute removed
- Used string `{{placeholder}}` interpolation instead of DOMParser (DOMParser not available in SW scope in this environment)

### Problems & Solutions

- **DOMParser unavailable in SW**: The `data-bind` attribute approach with DOMParser failed with "ReferenceError: DOMParser is not defined". Replaced with simple `{{key}}` string replacement — safe since templates and values are all controlled content.
- **Catch-all intercepting root redirect**: The 404 catch-all was catching `/?redirect=/files&fragment=` navigations. Fixed by using a callback matcher (`isUnknownNavigation`) that exempts root path, SPA routes, and validation path.

### Design Decisions

- **String interpolation over DOMParser**: DOMParser is documented as available in Chrome SW scope but failed in the preview environment (Edge/Chromium). String `{{key}}` replacement is simpler and equally safe for controlled content.
- **Removed NavigationRoute class**: The 404 catch-all now uses a plain registerRoute callback matcher instead of NavigationRoute. This gives precise control over which requests are caught — root path navigations (including with redirect params) pass through to the precache.

### Post-Implementation Fixes

- **Path-segment matching**: `startsWith` in SW and redirect-handler falsely matched `/filesxx` as `/files`. Replaced with `isSpaRoutePath()` that matches exact route or route+slash only.
- **React Router catch-all**: Added `<Route path="*" element={<Navigate to="/" replace />}>` in App.tsx to prevent blank page/"No routes matched" errors for unmatched client-side paths.

## 2026-05-25 — PWA & Test Infrastructure

### Done

- Added `vite-plugin-pwa` (v1.3.0) with `injectManifest` strategy for service worker authoring
- Created `apps/web/src/sw.ts` — service worker with `precacheAndRoute`, `skipWaiting`, `clients.claim`
- Created placeholder PWA icons (192×192, 512×512) in `apps/web/public/`
- Configured PWA manifest with Exstudeo branding (name, description, standalone display, theme/background colors)
- Added `manifest.json` link and theme-color meta tag to `index.html`
- Updated `apps/web/tsconfig.app.json` to exclude `src/sw.ts` from app build (separate SW compilation via VitePWA)
- Added `vitest` (v4.1.7) with separate `vitest.config.ts` (avoids VitePWA plugin conflict in tests)
- Added `@testing-library/react` (v16.3.2), `@testing-library/jest-dom` (v6.9.1), `@testing-library/user-event` (v14.6.1), `jsdom` (v29.1.1)
- Created `apps/web/src/test/setup.ts` with jest-dom/vitest import and `matchMedia` polyfill
- Added `test` and `test:run` scripts to `apps/web/package.json`
- Created co-located tests: `theme-provider.test.tsx` (3 tests) and `utils.test.ts` (3 tests)
- Workbox packages (`workbox-precaching`, `workbox-core`, `workbox-routing`, `workbox-strategies`) available via hoisting

### Design Decisions

- **injectManifest over generateSW**: Full control over SW source, easy path to future runtime caching for reader content
- **Separate vitest.config.ts**: Avoids VitePWA plugin activation during test runs
- **Auto-update SW**: No user prompts — `skipWaiting()` + `clients.claim()` on install/activate
- **Dev-mode SW**: Enabled via `devOptions.enabled: true` with `type: 'module'`
- **Co-located tests**: `Component.test.tsx` next to source files

### Problems & Solutions

- `vite-plugin-pwa` initially used `generateSW` mode because `strategies: 'injectManifest'` was missing — added it (`strategies: "injectManifest"` with `srcDir`/`filename` at top level)
- `@testing-library/jest-dom` v6 requires `import "@testing-library/jest-dom/vitest"` (not `/jest-dom`) for Vitest compatibility
- `window.matchMedia` not available in jsdom — polyfilled in test setup file
- Manual `<link rel="manifest" href="/manifest.json">` in `index.html` was wrong — `vite-plugin-pwa` generates `manifest.webmanifest` and auto-injects the correct link. Removed the manual duplicate.

## 2026-05-26 — ZenFS File Explorer

### Done

- Added `@zenfs/core` and `@zenfs/dom` dependencies for virtual filesystem over File System Access API
- Added `react-router` v7 for client-side routing
- Added shadcn/ui components: `tabs`, `table`, `dialog`, `dropdown-menu`, `breadcrumb`
- Created `src/lib/mount-store.ts` — IndexedDB persistence layer for `MountEntry[]` (add, load, update, delete, permission helpers)
- Created `src/lib/zenfs.ts` — global ZenFS singleton with `configure()`, `mountBackend()`, `unmountBackend()`, reactive snapshot state
- Created `src/hooks/use-zenfs.ts` — React hook providing reactive `fs`, `promises`, mount entries, and CRUD actions
- Created tabbed app shell with React Router + shadcn Tabs (`src/components/layout/app-shell.tsx`)
- Created mounts management dialog (`src/components/layout/mounts-dialog.tsx`) — add via `showDirectoryPicker()`, mount/unmount toggle, permanent remove
- Created file explorer page (`src/components/file-explorer/page.tsx`) — reads ZenFS root, shows directory table with breadcrumb
- Created directory table (`src/components/file-explorer/directory-table.tsx`) — shadcn Table with Name/Size/Type/Modified columns, column sorting, parent navigation
- Created path breadcrumb (`src/components/file-explorer/path-breadcrumb.tsx`) — shadcn Breadcrumb with clickable segments
- Created placeholder reader page (`src/components/reader/page.tsx`)
- Updated `App.tsx` with `BrowserRouter` and `<Routes>` for `/files` and `/reader`
- Updated `apps/web/readme.md` with new capabilities

### Design Decisions

- **ZenFS over raw FSA**: POSIX API (`readdirSync`, `statSync`) is more ergonomic than async iterators; handles caching, metadata indexing
- **Module singleton over React context**: Simpler, no provider nesting, works from both components and utilities
- **IndexedDB for handle storage**: `FileSystemDirectoryHandle` supports structured cloning; tiny API surface
- **URL-driven tabs**: `/files` and `/reader` routes drive active tab; file explorer internal navigation is local state
- **Dynamic mount lifecycle**: Mount (activate in ZenFS), unmount (deactivate, keep handle), remove (delete from IndexedDB)
- **Greyed-out unmounted entries**: Unmounted entries shown at 50% opacity in the mounts dialog
- **Default mount path `/localhost`**: User is prompted for mount path when adding a directory
- **Browse-only explorer**: No CRUD operations in this change; file clicks are stubs

### Notes

- File System Access API is Chromium-only — Safari/Firefox will show the "no file system configured" empty state
- ZenFS `WebAccess` backends map directory handles to POSIX paths; the ZenFS root `/` shows all mounted backends as top-level directories
- 2 pre-existing lint warnings remain (not from this change): `utils.test.ts` constant-binary-expression and `vitest.config.ts` triple-slash reference

## 2026-05-26 — PWA Offline Support Fix

### Done

- Added SPA navigation fallback in `sw.ts` via `NavigationRoute(createHandlerBoundToURL("index.html"))` — serves `index.html` for any unmatched navigation request (`/files`, `/reader`, etc.), enabling offline browsing of all SPA routes
- Added `cleanupOutdatedCaches()` to `sw.ts` for proper cache cleanup on SW updates
- Added `globPatterns: ["**/*.{js,css,html,json,png,svg,ico,woff2}"]` in the `injectManifest` config inside `vite.config.ts` — ensures all 8 Inter font `.woff2` variants are included in the precache manifest
- Created `src/lib/fsa-types.d.ts` — TypeScript type augmentations for File System Access API (`showDirectoryPicker`, `requestPermission`, `queryPermission`) not yet present in TS 5.9 DOM lib
- Fixed `asChild` prop on `DialogTrigger`/`DropdownMenuTrigger` — base-ui uses `render` prop instead of Radix-style `asChild`. Removed the prop to rely on default native button rendering
- Fixed missing `DropdownMenuTrigger` closing tag

### Design Decisions

- **NavigationRoute approach**: For `injectManifest` strategy, the SPA navigation fallback must be handled manually in the SW code rather than via a top-level `navigateFallback` config option (which only works with `generateSW` strategy)
- **Font precaching via globPatterns**: Added `woff2` to the `globPatterns` under `injectManifest` config. The workbox build step scans the `dist/assets/` folder and includes all matching files in the precache manifest

### Verification

- `npm run build` succeeds with precache manifest containing all 8 Inter `.woff2` files + JS/CSS/HTML/png
- Generated `dist/sw.js` contains `NavigationRoute(createHandlerBoundToURL("index.html"))` for SPA fallback
- `npm run dev` starts without errors

## 2026-05-26 — Archive Completed Changes

### Done

- Archived `add-zen-fs-file-explorer` and `pwa-and-test-setup` changes to `openspec/changes/archive/`
- Both changes had all artifacts complete, all tasks done, and delta specs already synced to main specs
- No warnings during archiving

## 2026-05-26 — Config System & Settings Tab

### Done

- Created `src/lib/config.ts` — typed config interfaces (`EpubConfig`, `GhGistConfig`, `GeneralConfig`), composite `AppConfig` type, and `DEFAULT_CONFIG` with `epub.zenFSPath` defaulting to `"/epubs"`
- Created `src/lib/config-store.ts` — IndexedDB-backed persistent config store (`exstudeo-configs`, per-domain documents keyed by domain) with:
  - `getConfig()` / `getAllConfigs()` — merge-on-read semantics (stored values overlaid on defaults)
  - `setConfig()` — upsert one domain, auto-refreshes reactive cache
  - `resetConfig()` — delete one or all domains
  - Reactive `subscribe()`/`getSnapshot()` infrastructure matching the `zenfs.ts` pattern
- Created `src/hooks/use-config.ts` — `useConfig()` hook via `useSyncExternalStore` returning `{ config, setDomain, resetDomain }`
- Created `src/components/settings/page.tsx` — raw JSON editor tab with:
  - Pretty-printed JSON textarea (2-space indent), synced to current config
  - **Save**: parses JSON, splits by domain, persists each; shows inline error on invalid JSON
  - **Discard**: reloads textarea from IDB (reverts all in-memory edits)
  - **Reset**: clears all config from IDB, textarea reloads with full defaults
- Added `/settings` to `SPA_ROUTES` in `route.path.ts`
- Wired `<Route path="settings">` to `<SettingsPage />` in `App.tsx`
- Added "Settings" tab to app shell tab bar and `<TabsContent>` panel

### Design Decisions

- **Per-domain IDB documents**: SW can read only `general` config without loading EPUB settings; concurrent writes don't clobber unrelated domains
- **Merge-on-read, no schema versioning**: `{ ...DEFAULT_CONFIG[domain], ...stored }` — new keys get defaults automatically, no migration needed
- **Explicit Save/Discard/Reset**: No auto-save — users can experiment with JSON safely
- **`zenFSPath` as convention, not coupling**: Config specifies the working directory path; it's decoupled from mount-store. The user/programming logic ensures a mount exists at that path
- **Reactive pattern mirrors `use-zenfs`**: `useSyncExternalStore` with `subscribe`/`getSnapshot` for consistency

### Bug Fixes

- **Config cache not hydrated on app start**: The module-level `_cachedConfig` in `config-store.ts` was initialized to bare defaults. No call to `getAllConfigs()` existed during app initialization, so the reactive snapshot always returned defaults regardless of persisted IDB data. Fixed by adding `await getAllConfigs()` to both the normal init path and the early-return (`isConfigured()`) path in `app-shell.tsx`'s `useEffect`.

## 2026-05-26 — SW EPUB HTML Routing

### Done

- Created `src/sw-routes/index.ts` — `SwRouteStrategy` interface (`name`, `match`, `handler`) and `registerStrategies()` helper; also exports shared `renderTemplate()` utility
- Created `src/sw-routes/zenfs-sw.ts` — SW-side independent ZenFS singleton with:
  - `ensureZenFS()` — reads mounts from IndexedDB, configures `@zenfs/core` with `WebAccess` backends
  - `computeHash()` — hash of active mount entries (id + mountPath) for skip-if-unchanged optimization
  - `markMountsDirty()` — sets dirty flag on postMessage from frontend
  - `findLongestPrefix()` — given a ZenFS path, finds the mounted path that is its longest prefix
  - `isEpubRoutePath()` — checks if pathname starts with `/@epubs/`
- Created `src/sw-routes/epub.ts` — `createEpubRouteStrategy()` returns `SwRouteStrategy` named `"epub-html"` with:
  - Match: same-origin GET, navigate or document destination, `/@epubs/*.html`
  - Handler: reads `epub.zenFSPath` from config-store, joins paths safely (traversal prevention), finds longest matching mount, reads file from ZenFS, serves as HTML 200 or styled 404 with reason
- Updated `src/sw.ts`:
  - Removed local `renderTemplate()` in favor of shared version in `sw-routes/index.ts`
  - Registered EPUB route via `registerStrategies([createEpubRouteStrategy()])` between validation page and 404 catch-all
  - Updated `isUnknownNavigation()` to exempt `/@epubs/` paths
  - Added `message` event listener for `"zenfs-reload"` → calls `markMountsDirty()`
- Updated `src/sw-templates/sw-not-found.html` — added `{{reason}}` placeholder for error details
- Updated `src/lib/zenfs.ts` — added `notifyServiceWorker()` function that posts `{ type: "zenfs-reload" }`; called after `mountBackend()` and `unmountBackend()`

### Design Decisions

- **SW-side ZenFS over Cache API**: SW imports `@zenfs/core` + `@zenfs/dom` directly, configuring its own instance from the same IndexedDB mount entries. FSA handles support concurrent reads safely.
- **Lazy reload via postMessage**: Frontend sets dirty flag, SW re-reads IDB on next request — avoids reconfiguring during an in-flight request.
- **`renderTemplate()` moved to shared module**: `sw-routes/index.ts` now exports it so both `sw.ts` and `epub.ts` use the same utility without circular imports.
- **Longest-prefix mount matching**: Handles cases where mounts are at `/` (root) or specific paths like `/epubs` — picks the most specific match.

### Verification

- `npm run build` succeeds with SW compiling 213 modules (ZenFS deps bundled into SW), 17 precache entries
- All 15 implementation tasks complete

## 2026-05-26 — File Explorer fsUrlBidirectional Links

### Done

- Added optional `href?: string` field to `FileEntry` interface in `directory-table.tsx` — if set, the entry renders as a hyperlink
- Updated `FileExplorerPage` to import `useConfig()` and compute `href` for each file entry whose ZenFS path falls under a prefix in `config.explorer.fsUrlBidirectional` (default: `["/epubs"]`)
- Href transforms `<basepath>/<rest>` to `/@<routerpath>/<rest>` (e.g., `/epubs/subdir/file.html` → `/@epubs/subdir/file.html`)
- Updated `DirectoryTable` name cell — renders `<a href>` with `target="_blank"`, `hover:underline text-primary`, and `stopPropagation` when `entry.href` is set; plain `<span>` otherwise
- Updated row-level `onClick` — entries with `href` open in new tab via `window.open(entry.href, "_blank", "noopener,noreferrer")`; directory entries navigate in-app; other files fall through to the existing `onOpenFile` stub
- Directories and parent ".." entry never receive `href` (gated by `isDirectory` check)
- Synced delta spec to `openspec/specs/file-explorer/spec.md` — added new requirement with 5 scenarios

### Design Decisions

- **`target="_blank"` over full-page navigation**: The SW-served `/@epubs/` URLs are read-only rendered views. Opening in a new tab lets users keep the file explorer open for further browsing.
- **`stopPropagation` on `<a>`**: Prevents the row-level `onClick` from also firing, so the link opens exactly once in a new tab.
- **Href computed in page, not table**: `DirectoryTable` remains a pure presentational component; `href` is computed in `FileExplorerPage`'s `useMemo` alongside other entry data.
## 2026-05-26 — SW EPUB MIME Support

### Done

- Created `src/sw-routes/mime.ts` — `inferMimeType()` utility with comprehensive extension-to-Content-Type mapping (HTML, XHTML, XML, CSS, JS, JSON, SVG, 8 image formats, 4 font formats, audio/video, OPF → `application/xhtml+xml`; falls back to `text/plain`). Accepts both bare extensions and full file paths; case-insensitive. TSDoc documented.
- Updated `src/sw-routes/epub.ts`:
  - **Generalized match**: Dropped `request.mode`/`destination` filters and `.html` extension check. Now accepts any `GET` same-origin request under `/@epubs/`.
  - **Percent-decoding**: Applied `decodeURIComponent()` to the rest path extracted from `url.pathname` before ZenFS lookup, fixing CJK filename support.
  - **Binary read**: Switched from `readFile(path, "utf-8")` to `readFile(path)` returning `Uint8Array`. Copied to a concrete `new Uint8Array(raw)` to avoid `SharedArrayBuffer` type incompatibility with `Response`.
  - **MIME inference**: Uses `inferMimeType()` from the new `mime.ts` for the `Content-Type` header.
  - **Renamed**: Strategy name changed from `"epub-html"` to `"epub-resources"`.
- Updated `src/sw.ts`:
  - Updated comment for the EPUB registration block (references `epub-resources`)
  - Cleaned up unused imports (`PrecacheEntry`, `NavigationRoute`, `SPA_ROUTES`)
- Remaining unused import cleanup: `SPA_ROUTES` was imported but unused in SW; removed alongside `PrecacheEntry` and `NavigationRoute`

### Design Decisions

- **`Uint8Array` copy for type safety**: ZenFS returns `Uint8Array<ArrayBufferLike>` which has a `SharedArrayBuffer`-compatible `buffer` type. Blob/Response accept only `ArrayBuffer`. A `new Uint8Array(raw)` copy resolves this cleanly.
- **Blob vs raw Uint8Array**: Initially tried `new Blob([content])` but the same `SharedArrayBuffer` issue applies to `BlobPart` union. The `new Uint8Array()` copy works for both.

### Verification

- `npm run build` succeeds — both app bundle and SW bundle compile without errors (2159 frontend modules, 214 SW modules)
- ESLint clean on all changed files
- `tsc -b --noEmit` passes with no errors

## 2026-05-26 — Spec Sync: sw-epub-html-routing + sw-epub-mime-support

### Done

- **`openspec/specs/sw-route-epub/spec.md`**: Replaced the old `.html`-only spec with the generalized "EPUB Resources" spec from `sw-epub-mime-support` delta:
  - Strategy name: `"epub-html"` → `"epub-resources"`
  - Match: accepts all `GET` same-origin under `/@epubs/` (dropped mode/destination/.html filters)
  - Handler: added percent-decoding (`decodeURIComponent`), binary read (`Uint8Array`), MIME inference via `inferMimeType()`
  - New scenarios: image/font/CSS fetch matches, CJK decoding, `.opf` as `application/xhtml+xml`, unknown extension fallback
- **`openspec/specs/sw-route-mime/spec.md`**: Created new spec for the MIME type mapping utility:
  - 20+ extension-to-Content-Type mapping table
  - Case-insensitive lookup
  - Full path support with extension extraction
  - `text/plain` fallback for unknown/missing extensions
- **`openspec/specs/sw-routing/spec.md`**: Updated reference from "EPUB html" to "EPUB resources" in the registration order scenario