## 1. Create sw-routes module scaffold

- [x] 1.1 Create `src/sw-routes/` directory with `index.ts` — define `SwRouteStrategy` interface and `registerStrategies()` function using workbox-routing types
- [x] 1.2 Create `src/sw-routes/epub.ts` — implement `createEpubRouteStrategy()` returning an `SwRouteStrategy` with name `"epub-html"`, proper match callback, and handler stub

## 2. Implement SW-side ZenFS singleton

- [x] 2.1 Create `src/sw-routes/zenfs-sw.ts` — implement `ensureZenFS()` that reads mount entries from IndexedDB (using `loadMounts` from `mount-store`), finds mounted entries, and calls `@zenfs/core`'s `configure()` with `WebAccess` backend
- [x] 2.2 Implement mount hash comparison — `ensureZenFS()` computes a hash of active mount entries (id + mountPath + mounted) and skips reconfiguration if unchanged; re-reads lazily when `_mountsDirty` is true
- [x] 2.3 Implement longest-prefix mount resolution helper — given `zenFSPath`, find the mounted path that is the longest prefix; return the mount entry or null

## 3. Implement the EPUB html route handler

- [x] 3.1 Implement path joining utility with traversal prevention — normalizes `/`, `..`, `.` segments safely
- [x] 3.2 Implement `handler` in `epub.ts`: reads `epub.zenFSPath` from config-store, resolves rest path from URL, computes full ZenFS path, finds longest matching mount, reads file via `zenfsPromises.readFile()`, returns 200 HTML or styled 404 with reason
- [x] 3.3 Update `sw-not-found.html` template to accept a `{{reason}}` placeholder (add to template and renderTemplate call site)

## 4. Integrate into sw.ts

- [x] 4.1 Add `message` event listener in `sw.ts` that sets `_mountsDirty = true` on `zenfs-reload` messages
- [x] 4.2 Import `createEpubRouteStrategy` and `registerStrategies`, register the EPUB strategy between validation and 404 handlers
- [x] 4.3 Update `isUnknownNavigation()` to exempt `/@epubs/` paths (they are handled by the EPUB route)

## 5. Add postMessage notification to frontend ZenFS singleton

- [x] 5.1 Add `notifyServiceWorker()` function in `lib/zenfs.ts` that posts `{ type: "zenfs-reload" }` to `navigator.serviceWorker.controller` (gracefully handles null)
- [x] 5.2 Call `notifyServiceWorker()` after `mountBackend()` and `unmountBackend()` complete successfully

## 6. Verify and test

- [x] 6.1 Run `npm run build` in `apps/web` to confirm SW compiles with new modules
- [x] 6.2 Verify mount hash comparison works correctly (same mounts → skip reconfigure; different mounts → reconfigure)
