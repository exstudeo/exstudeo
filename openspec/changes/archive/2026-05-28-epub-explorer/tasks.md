## 1. Refactor Foundation Types and ViewModel

- [x] 1.1 Simplify `EpubCollection` type in `type.ts` from mapped-type to `{ [key: string]: EpubCollection | IEpub }`
- [x] 1.2 Add `isEpub(value: EpubCollection | IEpub): value is IEpub` type guard utility
- [x] 1.3 Refactor `ViewModel` to accept `fs: typeof import("@/lib/zenfs").fs` instead of `ZenFSState`; fix `readonly private` ordering; remove unused `useZenFS` import
- [x] 1.4 Implement `ViewModel.getCollectionFromStorage()` — scan ZenFS directory under `epub.zenFSPath`, read `*.epub.json` metadata files, build `EpubCollection`
- [x] 1.5 Implement `ViewModel.updateViewModelFile()` — write current collection to `viewModel.json`
- [x] 1.6 Implement `ViewModel.regenerateFromDirectory()` — calls `getCollectionFromStorage()` → writes `viewModel.json` → replaces in-memory collection → calls `notifyUpdate()`

## 2. Add Route and Tab Infrastructure

- [x] 2.1 Add `/epub` to `SPA_ROUTES` in `route.path.ts`
- [x] 2.2 Add "epub" tab entry to `TABS` array and `TabsContent` in `app-shell.tsx`
- [x] 2.3 Add `<Route path="epub/*">` in `App.tsx` pointing to a placeholder component
- [x] 2.4 Install shadcn-tree-view in `packages/ui`: `cd packages/ui && npx shadcn add "https://mrlightful.com/registry/tree-view"`

## 3. Build EPUB Explorer Components

- [x] 3.1 Create `EpubViewContext` — React context holding ViewModel instance via `useRef` + `useSyncExternalStore`, exposes `viewModel` and `collection` with a comment that no cleanup is required
- [x] 3.2 Create `EpubTree` component — transforms `EpubCollection` → `TreeDataItem[]` and renders `<TreeView>`; collection nodes display key name, epub nodes display `title || uniqueIdentifier`
- [x] 3.3 Create `EpubItemMenu` component — renders `<DropdownMenu>` with "Add Epub" (on collection nodes) and "Delete Epub" (on epub leaf nodes); actions wired to ViewModel methods
- [x] 3.4 Create `AddFromDirectory` component — renders "From Directory" button, calls `viewModel.regenerateFromDirectory()` on click
- [x] 3.5 Create `EpubExplorerPage` — wires context, tree, from-directory button, and handles "not configured" state (matching File Explorer pattern)

## 4. Wire and Verify

- [x] 4.1 Replace placeholder route component in `App.tsx` with `EpubExplorerPage`
- [x] 4.2 Verify all files compile with `npm run typecheck`
- [x] 4.3 Verify build succeeds (tsc -b + vite build)

## 5. Implement EPUB Add/Delete and Storage Convention Fixes

- [x] 5.1 Update `_scanDir` to skip directories ending with `.epubdir` instead of checking sibling `.epub.json`; update header doc comment
- [x] 5.2 Implement `AddEpubsAt()` — for each file: call `extractEpub()` → write `.epub` binary, `.epub.json` metadata, and `.epubdir/` content directory to ZenFS → update in-memory collection → persist `viewModel.json` → notify subscribers
- [x] 5.3 Add skip-on-error logic to `AddEpubsAt()` — catch individual failures, `console.warn`, collect names, return a summary object with succeeded/failed counts
- [x] 5.4 Implement `DelEpubsAt()` — remove from in-memory collection first → delete `.epub`, `.epub.json`, `.epubdir/` from ZenFS → persist `viewModel.json` → notify subscribers; add `_rmdirSync` recursive helper for `.epubdir/` removal
- [x] 5.5 Add "Add Epub" button to the EPUB explorer toolbar (next to "From Directory") with a hidden `<input type="file" accept=".epub" multiple>` that calls `viewModel.AddEpubsAt(files, [])`
- [x] 5.6 Wire the per-collection-node "Add Epub" dropdown action to open the same hidden file input with the correct `collectionPath`
- [x] 5.7 Wire the per-EPUB-node "Delete Epub" dropdown action to call `viewModel.DelEpubsAt([epubId], collectionPath)`
- [x] 5.8 Verify build succeeds after all changes