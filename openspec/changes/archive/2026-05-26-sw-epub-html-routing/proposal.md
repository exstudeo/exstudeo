## Why

The app will serve EPUB HTML content through a dedicated URL namespace (`/@epubs/`), allowing the service worker to intercept these requests and serve files directly from the user's mounted directories via ZenFS. This is the foundation for the EPUB reader feature — it enables serving unpacked EPUB content without a server round-trip.

## What Changes

- Introduce a **pluggable SW route strategy framework** (`sw-routes/`) with a clean TypeScript interface for registering named route handlers via Workbox
- Add an **EPUB HTML route strategy** that intercepts GET requests to `/@epubs/*.html` (both `navigate` and `document` destinations) and serves the file from ZenFS if it exists
- Add a **SW-side ZenFS integration** that reads mount entries from IndexedDB and configures its own ZenFS instance (independent from the frontend's instance)
- Add a **postMessage protocol** where the frontend notifies the SW of mount changes (`zenfs-reload`), causing the SW to lazily re-read mount state on the next request
- Add a **refresh utility** `notifyServiceWorker()` to the frontend's ZenFS singleton that sends the postMessage after mount/unmount operations
- Extend the 404 catch-all to **exempt** `/@epubs/` paths (they are handled by the EPUB route)

## Capabilities

### New Capabilities
- `sw-route-epub`: Service worker route strategy that intercepts `GET /@epubs/*.html` requests, resolves the ZenFS mount matching the configured `zenFSPath`, reads the HTML file, and serves it with `Content-Type: text/html`. Falls back to a styled 404 page if the mount or file is not found.

### Modified Capabilities
- `sw-routing`: The existing SW routing architecture is extended with a pluggable strategy pattern (`SwRouteStrategy` interface + `registerStrategies()` helper) so future interceptors (e.g., `@ghgist/`) can be added as independent modules. The 404 catch-all matcher updates to exempt `/@epubs/` paths.
- `zenfs-integration`: The frontend's ZenFS singleton gains a `notifyServiceWorker()` function that posts a `{ type: "zenfs-reload" }` message to the active service worker after mount/unmount operations. The SW-side gets its own independent ZenFS instance configured from IndexedDB mount entries.

## Impact

- **`apps/web/src/sw.ts`**: Imports and registers the EPUB route strategy using `registerStrategies()`. Adds a `message` event listener for `zenfs-reload`. Updates `isUnknownNavigation()` to exempt `/@epubs/` paths.
- **`apps/web/src/sw-routes/`** (new): Contains `index.ts` (strategy interface + registry), `epub.ts` (EPUB HTML strategy), and `zenfs-sw.ts` (SW-side ZenFS singleton).
- **`apps/web/src/lib/zenfs.ts`**: Imports `notifyServiceWorker()` calls after `mountBackend()` and `unmountBackend()` complete.
- **`apps/web/src/lib/mount-store.ts`**: No changes (SW imports directly from IDB using the same schema).
- **`apps/web/src/lib/config-store.ts`**: No changes (SW reads `epub.zenFSPath` from IDB using existing API).
- **No new dependencies** — uses existing `@zenfs/core`, `@zenfs/dom`, `workbox-routing`.
