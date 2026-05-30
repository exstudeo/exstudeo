# ZenFS Integration

## Purpose

A global singleton layer that integrates `@zenfs/core` with the `@zenfs/dom` WebAccess backend into the React app. Provides a POSIX virtual filesystem over File System Access API handles, with reactive state for live UI updates.

## Requirements

### Requirement: Global ZenFS singleton
The system SHALL provide a global singleton module (`lib/zenfs.ts`) that configures ZenFS with the `WebAccess` backend and re-exports the `fs` and `promises` APIs for use throughout the application.

#### Scenario: Module exports fs and promises
- **WHEN** any module imports from `@/lib/zenfs`
- **THEN** it receives the configured `fs` (sync API) and `promises` (async API) objects

#### Scenario: Configure with mounts
- **WHEN** `zenfs.ts.configure()` is called with an array of mount entries
- **THEN** each entry with `mounted: true` is mounted at its `mountPath` using the `WebAccess` backend, and `fs.readdirSync('/')` returns the mount point directories

### Requirement: Dynamic mount and unmount
The system SHALL support mounting and unmounting backends at runtime after initial configuration.

#### Scenario: Mount at runtime
- **WHEN** `zenfs.ts` receives a mount entry to add after initial configuration
- **THEN** a new `WebAccess` backend is mounted at the entry's mount path, and the entry appears under `/` in the filesystem

#### Scenario: Unmount at runtime
- **WHEN** `zenfs.ts` receives a mount entry to unmount
- **THEN** the backend is unmounted and the entry disappears from `/`

### Requirement: Error handling for permission loss
The system SHALL gracefully handle cases where the File System Access API permission has been revoked for a handle.

#### Scenario: Mount with revoked permission
- **WHEN** an attempt is made to mount a handle whose permission is denied
- **THEN** the mount fails gracefully, the entry remains unmounted, and the caller receives an error indication

### Requirement: Expose mount state reactively
The system SHALL expose the current mount state (list of mount entries, which are mounted) in a way that React components can observe and re-render on changes.

#### Scenario: Component observes mount changes
- **WHEN** a mount entry is added, removed, mounted, or unmounted
- **THEN** React components using the ZenFS hook re-render with the updated state

### Requirement: Frontend notifies service worker of mount changes

The frontend ZenFS singleton (`lib/zenfs.ts`) SHALL export a function `notifyServiceWorker()` that posts a message `{ type: "zenfs-reload" }` to the active service worker via `navigator.serviceWorker.controller`. This function SHALL be called after every mount and unmount operation (`mountBackend()` and `unmountBackend()`). It SHALL silently handle the case where no service worker is active.

#### Scenario: Post message after mount
- **WHEN** `mountBackend()` completes successfully
- **THEN** `notifyServiceWorker()` is called
- **AND** it posts `{ type: "zenfs-reload" }` to the service worker controller

#### Scenario: Post message after unmount
- **WHEN** `unmountBackend()` completes successfully
- **THEN** `notifyServiceWorker()` is called
- **AND** it posts `{ type: "zenfs-reload" }` to the service worker controller

#### Scenario: Handles missing service worker gracefully
- **WHEN** `notifyServiceWorker()` is called but `navigator.serviceWorker.controller` is `null`
- **THEN** the function completes without throwing

### Requirement: Frontend notifies service worker of file mutations

The frontend SHALL also call `notifyServiceWorker()` after modifying files within an already-mounted backend (e.g., writing or deleting files under `/epubs/`), not only on mount/unmount. The SW's independent ZenFS instance holds a separate inode table that becomes stale after file mutations; without this notification, the SW serves mismatched file data (throwing `"Unexpected mismatch in file data size"`).

#### Scenario: ViewModel notifies SW after viewModel.json write
- **WHEN** `ViewModel._writeViewModelFile()` successfully writes `viewModel.json`
- **THEN** it calls `notifyServiceWorker()`
- **AND** the SW sets `_mountsDirty = true`

#### Scenario: SW always reconfigures when dirty
- **WHEN** `ensureZenFS()` is called with `_mountsDirty = true`
- **THEN** it ALWAYS calls `zenfsConfigure()` with fresh FSA handles, regardless of whether the mount entry list changed
- **AND** clears `_mountsDirty`

#### Scenario: SW does not skip reconfigure on hash match
- **WHEN** the mount entry list has not changed but file contents have been modified
- **THEN** the SW still reconfigures (no mount-hash skip optimization)

### Requirement: Reactivity snapshots use fresh array references

The `notify()` function in `lib/zenfs.ts` SHALL create fresh array references for `_snapshot.entries` and `_snapshot.deniedIds` on every notification, using spread syntax `[..._mountEntries]` and `[..._skippedIds]`. This guarantees that React's `useSyncExternalStore` detects state changes even when the underlying arrays are mutated in-place.

#### Scenario: Entries array is a new reference on each notify
- **WHEN** a mount entry is added via `_mountEntries.push()`
- **THEN** `_snapshot.entries` receives a new array reference via `[..._mountEntries]`
- **AND** React components re-render

#### Scenario: No stale closure of array reference
- **WHEN** `_mountEntries` is mutated in-place (push/assignment)
- **THEN** the next `notify()` creates a fresh copy, so components using `useSyncExternalStore` detect the change
