# IndexedDB Backend

## Purpose

Support for IndexedDB as a ZenFS storage backend. Users can create IndexedDB-backed mount points that persist file data in the browser's IndexedDB database — no directory picker or permission prompt required.

## Requirements

### Requirement: User can add an IndexedDB mount
The system SHALL allow the user to create a mount entry backed by the IndexedDB storage backend without requiring a directory picker or permission prompt.

#### Scenario: Add IndexedDB mount
- **WHEN** the user selects "IndexedDB" as the backend type, enters a mount path (e.g., `/cache`), and clicks "Add"
- **THEN** the system creates a `MountEntry` with `backend: { kind: 'indexeddb' }`, a unique id, the entered name, and `mounted: true`
- **AND** the IndexedDB backend is mounted at the specified path in ZenFS immediately

#### Scenario: IndexedDB mount store name is auto-derived
- **WHEN** an IndexedDB mount is created with mount path `/cache` and no explicit `storeName`
- **THEN** the ZenFS `IndexedDB` backend is configured with `storeName` derived from the mount path (e.g., `zenfs-/cache`)
- **AND** each IndexedDB mount uses a unique database name, preventing data collisions between mounts

#### Scenario: IndexedDB mount with explicit store name
- **WHEN** an IndexedDB mount is created with an explicit `storeName` (e.g., `"my-custom-store"`)
- **THEN** the provided `storeName` is used instead of the auto-derived name

### Requirement: IndexedDB availability is checked before mount
The system SHALL verify that IndexedDB is available in the current browser before mounting an IndexedDB backend.

#### Scenario: IndexedDB available
- **WHEN** the system checks IndexedDB availability via `IndexedDB.isAvailable()`
- **AND** the browser supports IndexedDB normally
- **THEN** the mount proceeds successfully

#### Scenario: IndexedDB unavailable
- **WHEN** the system checks IndexedDB availability
- **AND** IndexedDB is not available (e.g., private browsing, iframe sandbox)
- **THEN** the mount fails with a `BackendValidationError`
- **AND** the entry remains unmounted and the user is shown an error message

### Requirement: IndexedDB mounts never need reconnection
The system SHALL NOT offer reconnection for IndexedDB mount entries since IndexedDB does not use permission-based access.

#### Scenario: IndexedDB mount row shows no reconnect button
- **WHEN** the mount list displays an IndexedDB-backed entry
- **THEN** the row does NOT show a reconnect button
- **AND** the entry is never added to the `deniedEntries` map

#### Scenario: IndexedDB mount survives page reloads
- **WHEN** the app reloads with an IndexedDB mount entry that has `mounted: true`
- **THEN** the mount is automatically re-established without any user interaction

### Requirement: IndexedDB mount data persists across sessions
The system SHALL persist all file data written to an IndexedDB-backed mount point in the browser's IndexedDB database, surviving page reloads and browser restarts.

#### Scenario: File persists across reload
- **WHEN** a file is written to an IndexedDB-backed mount point
- **AND** the page is reloaded
- **THEN** the file is still readable from the same mount path