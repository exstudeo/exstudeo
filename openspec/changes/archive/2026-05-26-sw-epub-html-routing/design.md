## Context

The current service worker has a three-tier routing system (SPA redirect → validation → 404) hardcoded in `sw.ts`. The EPUB reader feature needs the SW to intercept `GET /@epubs/*.html` requests and serve HTML files directly from the user's ZenFS-mounted directories. This requires:

1. A pluggable strategy pattern so future interceptors (e.g., `/@ghgist/`) can be added modularly
2. An independent ZenFS instance in the SW that reads mount entries from IndexedDB
3. A frontend→SW postMessage protocol to keep the SW's mount state in sync

## Goals / Non-Goals

**Goals:**
- Define a reusable `SwRouteStrategy` interface and `registerStrategies()` helper in `sw-routes/index.ts`
- Implement `createEpubRouteStrategy()` in `sw-routes/epub.ts` that serves `/@epubs/*.html` from ZenFS
- Create a SW-side ZenFS singleton `sw-routes/zenfs-sw.ts` that configures from IndexedDB mount entries independently of the frontend
- Add a `notifyServiceWorker()` function in `lib/zenfs.ts` that posts a `{ type: "zenfs-reload" }` message after mount/unmount
- Add a `message` event listener in `sw.ts` that sets a dirty flag on `zenfs-reload`, causing lazy re-read on next request
- Update the 404 catch-all in `sw.ts` to exempt `/@epubs/` paths

**Non-Goals:**
- Caching of ZenFS file reads (not needed for v1)
- Handling non-`.html` requests under `/@epubs/`
- Other route strategies (e.g., `/@ghgist/`) — future work
- Changes to the mount-store or config-store IndexedDB schemas

## Decisions

### Decision: SW runs its own independent ZenFS instance
- **Choice**: The SW imports `@zenfs/core` + `@zenfs/dom` directly and calls `configure()` on `install`/`activate`, reading mount entries from the same IndexedDB as the frontend
- **Rationale**: The frontend's ZenFS singleton is not accessible from the SW scope (different global context). Both instances read/write to the same underlying FSA handles — this is safe because FSA handles support concurrent read access and file writes are atomic at the OS level.
- **Alternative considered**: Have the frontend pre-populate the Cache API — rejected because it adds duplication and orchestration complexity.

### Decision: Lazy reload via postMessage dirty flag
- **Choice**: The SW sets `_mountsDirty = true` on receiving a `zenfs-reload` message. On the next `/@epubs/` request, `ensureZenFS()` re-reads from IndexedDB and reconfigures if changed.
- **Rationale**: Avoids eager reconfiguration (which could interfere with an in-flight request) while keeping the eventual consistency window small.
- **Alternative considered**: Eager reconfiguration — rejected because a reconfigure could race with an active request. Re-reading IDB on every request — rejected because the postMessage approach is still simple and reduces unnecessary IDB reads.

### Decision: Path matching uses longest mountPath prefix
- **Choice**: Given a `zenFSPath` like `/epubs`, find the mounted path that is the longest prefix of that path. This handles cases where `/epubs` is mounted directly, or a parent like `/` is mounted.
- **Rationale**: The user may mount at `/` (their entire FSA root). We need to resolve the actual FSA path correctly regardless of mount depth.
- **Alternative considered**: Require exact match — rejected because it's less flexible and breaks if someone mounts at a parent directory.

### Decision: Separate `sw-routes/` directory for strategy modules
- **Choice**: Each route strategy gets its own file under `src/sw-routes/`, imported by `sw.ts`.
- **Rationale**: Clean separation of concerns. Future strategies (e.g., `gist.ts`) can be added without touching existing ones. The `index.ts` provides only the interface + registry helper.
- **Alternative considered**: All strategies in `sw.ts` — rejected because it would grow unmanageable.

## Risks / Trade-offs

- **[Concurrent FSA access]** Frontend and SW may both read from the same FSA handle. → **Mitigation**: FSA supports concurrent reads; file reads return isolated `File` objects. Writes are atomic (stream-close commits). The SW only reads (GET), so no writer conflict.
- **[Permission loss]** User revokes FSA permission for a directory. → **Mitigation**: The SW's `ensureZenFS()` calls `queryPermission()` during mount setup; if denied, the route falls through to a styled 404. The SW cannot `requestPermission()` without a user gesture.
- **[Stale mount state during postMessage window]** A request arrives between IDB write and postMessage arrival. → **Mitigation**: The SW's `ensureZenFS()` reads fresh from IDB on every `/@epubs/` request (not from cache) when `_mountsDirty` is true, plus it always re-reads if the mount hash changed. The window is at most one request stale.
- **[SW activation timing]** If the frontend mounts directories before the SW activates (first visit), the SW won't see them. → **Mitigation**: On SW `activate`, it reads mounts from IDB and configures ZenFS. Subsequent mounts post `zenfs-reload` to sync.

## Open Questions

- None — all design decisions have been resolved through exploration.
