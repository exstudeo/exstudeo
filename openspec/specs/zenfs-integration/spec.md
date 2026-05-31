# ZenFS Integration

## Purpose

A global singleton layer that integrates `@zenfs/core` with multiple `@zenfs/dom` backends (WebAccess, IndexedDB, and future backends) into the React app. Provides a POSIX virtual filesystem over File System Access API handles and IndexedDB stores, with reactive state for live UI updates. Backend resolution is handled by a shared `resolveBackendConfig()` function used by both the frontend and service worker.

## Requirements

### Requirement: Backend resolver decouples backend creation from ZenFS wiring
The system SHALL provide a `resolveBackendConfig()` function in a new `lib/backend-resolver.ts` module that maps a `BackendConfig` discriminated union to a resolved ZenFS mount configuration. This function SHALL be used by both the frontend (`lib/zenfs.ts`) and service worker (`sw-routes/zenfs-sw.ts`) instead of importing `WebAccess` directly.

#### Scenario: Resolve FSA backend config
- **WHEN** `resolveBackendConfig({ kind: 'fsa', handle: <dirHandle> })` is called
- **AND** the handle has `readwrite` permission
- **THEN** it returns a ZenFS mount configuration using the `WebAccess` backend with the given handle

#### Scenario: Resolve IndexedDB backend config
- **WHEN** `resolveBackendConfig({ kind: 'indexeddb', storeName: 'zenfs-/cache' })` is called
- **AND** IndexedDB is available in the browser
- **THEN** it returns a ZenFS mount configuration using the `IndexedDB` backend with the given `storeName`

#### Scenario: Resolver throws BackendValidationError on FSA permission denied
- **WHEN** `resolveBackendConfig({ kind: 'fsa', handle: <dirHandle> })` is called
- **AND** the handle has permission denied
- **THEN** it throws a `BackendValidationError` with kind `'fsa'` and a descriptive message

#### Scenario: Resolver throws BackendValidationError on IndexedDB unavailable
- **WHEN** `resolveBackendConfig({ kind: 'indexeddb' })` is called
- **AND** `IndexedDB.isAvailable()` returns `false`
- **THEN** it throws a `BackendValidationError` with kind `'indexeddb'` and a descriptive message

### Requirement: Global ZenFS singleton
The system SHALL provide a global singleton module (`lib/zenfs.ts`) that configures ZenFS using `resolveBackendConfig()` to support multiple backend types, and re-exports the `fs` and `promises` APIs for use throughout the application.

#### Scenario: Module exports fs and promises
- **WHEN** any module imports from `@/lib/zenfs`
- **THEN** it receives the configured `fs` (sync API) and `promises` (async API) objects

#### Scenario: Configure with mounts of any backend type
- **WHEN** `mountBackend()` is called with a `MountEntry` containing a `BackendConfig`
- **THEN** the entry's backend is resolved via `resolveBackendConfig(entry.backend)` and mounted at its `mountPath`
- **AND** `fs.readdirSync('/')` returns the mount point directories regardless of backend type

### Requirement: Dynamic mount and unmount
The system SHALL support mounting and unmounting backends of any type at runtime after initial configuration.

#### Scenario: Mount at runtime
- **WHEN** `mountBackend()` receives a mount entry to add after initial configuration
- **THEN** `resolveBackendConfig()` resolves the appropriate backend, and a new backend is mounted at the entry's mount path
- **AND** the entry appears under `/` in the filesystem

#### Scenario: Unmount at runtime
- **WHEN** `unmountBackend()` receives a mount entry to unmount
- **THEN** the backend is unmounted and the entry disappears from `/`

### Requirement: Error handling for backend failures
The system SHALL gracefully handle cases where backend resolution or permission validation fails for any backend type.

#### Scenario: Mount with FSA permission denied
- **WHEN** an attempt is made to mount an FSA entry whose handle permission is denied
- **THEN** `resolveBackendConfig()` throws a `BackendValidationError`
- **AND** the mount fails gracefully, the entry is added to `deniedEntries`, and the caller receives an error indication

#### Scenario: Mount with IndexedDB unavailable
- **WHEN** an attempt is made to mount an IndexedDB entry
- **AND** `IndexedDB.isAvailable()` returns `false`
- **THEN** `resolveBackendConfig()` throws a `BackendValidationError`
- **AND** the mount fails gracefully, the entry is added to `deniedEntries`, and the caller receives an error indication

### Requirement: Denied entries are a map with backend-aware reasons
The system SHALL store entries that failed to mount in a `Map<string, string>` (`entryId → reason`) instead of a `Set<string>`. The reason string SHALL describe why the mount failed, enabling the UI to display contextual error messages.

#### Scenario: FSA entry added to deniedEntries with reason
- **WHEN** an FSA mount fails due to permission denial
- **THEN** the entry id is added to `_deniedEntries` with the reason `"Permission denied for directory handle."`
- **AND** the UI can display the reason to the user

#### Scenario: IndexedDB entry added to deniedEntries with reason
- **WHEN** an IndexedDB mount fails due to unavailability
- **THEN** the entry id is added to `_deniedEntries` with the reason `"IndexedDB is not available in this browser."`

#### Scenario: Reconnect resolves denied FSA entry
- **WHEN** `reconnectMount(id)` is called for an FSA entry in `_deniedEntries`
- **AND** permission is re-granted
- **THEN** the entry is removed from `_deniedEntries` and mounted

#### Scenario: Reconnect is no-op for IndexedDB entries
- **WHEN** `reconnectMount(id)` is called for an IndexedDB entry
- **THEN** the operation succeeds immediately without any permission prompt
- **AND** the entry is removed from `_deniedEntries`

### Requirement: Expose mount state reactively
The system SHALL expose the current mount state (list of mount entries, which are mounted, denied entries with reasons) in a way that React components can observe and re-render on changes.

#### Scenario: Component observes mount changes
- **WHEN** a mount entry is added, removed, mounted, or unmounted
- **THEN** React components using the ZenFS hook re-render with the updated state

#### Scenario: Component observes denied entries
- **WHEN** an entry fails to mount and is added to `deniedEntries`
- **THEN** React components using the ZenFS hook receive the updated `deniedEntries` map

### Requirement: Reactivity snapshots use fresh array and map references
The `notify()` function in `lib/zenfs.ts` SHALL create fresh array and map references for `_snapshot.entries` and `_snapshot.deniedEntries` on every notification, using spread syntax `[..._mountEntries]` and `new Map(_deniedEntries)`. This guarantees that React's `useSyncExternalStore` detects state changes even when the underlying collections are mutated in-place.

#### Scenario: Entries array is a new reference on each notify
- **WHEN** a mount entry is added via `_mountEntries.push()`
- **THEN** `_snapshot.entries` receives a new array reference via `[..._mountEntries]`
- **AND** React components re-render

#### Scenario: Denied entries map is a new reference on each notify
- **WHEN** an entry is added to or removed from `_deniedEntries`
- **THEN** `_snapshot.deniedEntries` receives a new `Map` reference via `new Map(_deniedEntries)`
- **AND** React components re-render

### Requirement: Frontend notifies service worker of mount changes
The frontend ZenFS singleton (`lib/zenfs.ts`) SHALL export a function `notifyServiceWorker()` that posts a message `{ type: "zenfs-reload" }` to the active service worker via `navigator.serviceWorker.controller`. This function SHALL be called after every mount and unmount operation (`mountBackend()` and `unmountBackend()`), regardless of backend type. It SHALL silently handle the case where no service worker is active.

#### Scenario: Post message after mount
- **WHEN** `mountBackend()` completes successfully for any backend type
- **THEN** `notifyServiceWorker()` is called
- **AND** it posts `{ type: "zenfs-reload" }` to the service worker controller

#### Scenario: Post message after unmount
- **WHEN** `unmountBackend()` completes successfully
- **THEN** `notifyServiceWorker()` is called
- **AND** it posts `{ type: "zenfs-reload" }` to the service worker controller

#### Scenario: Handles missing service worker gracefully
- **WHEN** `notifyServiceWorker()` is called but `navigator.serviceWorker.controller` is `null`
- **THEN** the function completes without throwing

### Requirement: Service worker ZenFS uses backend resolver
The service worker ZenFS singleton (`sw-routes/zenfs-sw.ts`) SHALL use `resolveBackendConfig()` from `lib/backend-resolver.ts` instead of importing `WebAccess` directly, enabling the SW to mount any backend type.

#### Scenario: SW resolves FSA backend via resolver
- **WHEN** `ensureZenFS()` processes mounted entries with FSA backends
- **THEN** it calls `resolveBackendConfig({ kind: 'fsa', handle: <handle> })` for each FSA entry
- **AND** mounts the resolved configuration in the SW's ZenFS instance

#### Scenario: SW resolves IndexedDB backend via resolver
- **WHEN** `ensureZenFS()` processes mounted entries with IndexedDB backends
- **THEN** it calls `resolveBackendConfig({ kind: 'indexeddb', storeName: <name> })` for each IndexedDB entry
- **AND** mounts the resolved configuration in the SW's ZenFS instance

### Requirement: Frontend notifies service worker of file mutations
The frontend SHALL also call `notifyServiceWorker()` after modifying files within an already-mounted backend (e.g., writing or deleting files), not only on mount/unmount. The SW's independent ZenFS instance holds a separate inode table that becomes stale after file mutations; without this notification, the SW serves mismatched file data.

#### Scenario: ViewModel notifies SW after viewModel.json write
- **WHEN** `ViewModel._writeViewModelFile()` successfully writes `viewModel.json`
- **THEN** it calls `notifyServiceWorker()`
- **AND** the SW sets `_mountsDirty = true`

#### Scenario: SW always reconfigures when dirty
- **WHEN** `ensureZenFS()` is called with `_mountsDirty = true`
- **THEN** it ALWAYS re-resolves all mounted backends via `resolveBackendConfig()`, regardless of whether the mount entry list changed
- **AND** clears `_mountsDirty`
