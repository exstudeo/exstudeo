# Mount Management

## Purpose

Persistent management of ZenFS mount entries with support for multiple backend types (File System Access API directory handles, IndexedDB, and future backends). Users can add, mount, unmount, and remove mounts. All entries are persisted in IndexedDB and automatically restored on app load.

## Requirements

### Requirement: MountEntry supports multiple backend types
The system SHALL store a `backend` field on each `MountEntry` containing a `BackendConfig` discriminated union (`{ kind: 'fsa', handle: FileSystemDirectoryHandle }` | `{ kind: 'indexeddb', storeName?: string }`). The existing `handle` field SHALL remain as an optional field for backward compatibility with persisted entries.

#### Scenario: New FSA mount has backend field
- **WHEN** a new File System Access mount is created
- **THEN** the `MountEntry` has `backend: { kind: 'fsa', handle: <FileSystemDirectoryHandle> }`
- **AND** the `handle` field is also set to the same directory handle for backward compatibility

#### Scenario: New IndexedDB mount has backend field
- **WHEN** a new IndexedDB mount is created
- **THEN** the `MountEntry` has `backend: { kind: 'indexeddb', storeName: 'zenfs-/cache' }`
- **AND** the `handle` field is absent or `undefined`

#### Scenario: Legacy entry without backend field is normalized on read
- **WHEN** an existing persisted `MountEntry` has a `handle` field but no `backend` field
- **THEN** the system synthesizes `backend: { kind: 'fsa', handle: <from entry.handle> }` at read time
- **AND** the entry functions identically to a new FSA entry

### Requirement: User can add mounts of different backend types
The system SHALL allow the user to choose a backend type (File System Access or IndexedDB) when adding a new mount. The add flow SHALL adapt to the selected backend type.

#### Scenario: Add FSA mount via directory picker
- **WHEN** the user selects "File System Access" backend and clicks "Add"
- **THEN** the native directory picker (`showDirectoryPicker`) opens
- **AND** on selection, the system creates a `MountEntry` with `backend: { kind: 'fsa', handle: <picked handle> }`

#### Scenario: Add IndexedDB mount without directory picker
- **WHEN** the user selects "IndexedDB" backend, enters a mount path, and clicks "Add"
- **THEN** the system creates a `MountEntry` with `backend: { kind: 'indexeddb' }` immediately
- **AND** no directory picker is shown

#### Scenario: Backend type label shown on mount rows
- **WHEN** the mount list displays entries
- **THEN** each row shows the backend type as a text label (e.g., "FSA" for File System Access, "IndexedDB" for IndexedDB)

### Requirement: Backend validation is backend-specific
The system SHALL validate mount configurations using backend-specific logic before mounting. Validation failures SHALL produce descriptive errors.

#### Scenario: FSA validation fails on permission denied
- **WHEN** an FSA mount is created and the directory handle has `readwrite` permission denied
- **THEN** the mount fails with a `BackendValidationError` indicating permission was denied
- **AND** the entry remains unmounted

#### Scenario: IndexedDB validation fails on unavailability
- **WHEN** an IndexedDB mount is created and `IndexedDB.isAvailable()` returns `false`
- **THEN** the mount fails with a `BackendValidationError` indicating IndexedDB is not available
- **AND** the entry remains unmounted

### Requirement: User can add a directory mount
The system SHALL allow the user to add a new mount entry with a choice of backend type. For File System Access backends, the user picks a directory via the File System Access API (`showDirectoryPicker`). Each mount entry SHALL store an id, user-given name, mount path, and a `BackendConfig` describing the backend.

#### Scenario: Add new FSA mount from picker
- **WHEN** the user selects "File System Access" backend and selects a folder via the native picker
- **THEN** the system creates a `MountEntry` with a unique id, the directory's name as default label, an auto-generated mount path, `backend: { kind: 'fsa', handle: <picked handle> }`, and `mounted: true`

#### Scenario: Add mount with custom name
- **WHEN** the user adds a mount and the system prompts for a label
- **THEN** the user-entered label is used as the mount entry name

### Requirement: Mount entry list is persisted
The system SHALL persist all mount entries in IndexedDB using a `mounts` object store keyed by entry `id`.

#### Scenario: Persist across reloads
- **WHEN** the user adds a mount entry and reloads the app
- **THEN** the mount entry is restored from IndexedDB on next load

#### Scenario: Remove entry permanently deletes
- **WHEN** the user removes a mount entry
- **THEN** the entry is deleted from IndexedDB permanently and unmounted from ZenFS

### Requirement: User can mount and unmount entries
The system SHALL allow the user to toggle a mount entry between mounted and unmounted states at runtime without deleting the stored entry. The mount process SHALL resolve the backend via `resolveBackendConfig()` which validates and creates the appropriate backend for the entry's `BackendConfig`.

#### Scenario: Mount an entry
- **WHEN** the user sets a stored entry to mounted
- **THEN** the system calls `resolveBackendConfig(entry.backend)` to resolve the backend configuration
- **AND** mounts the resolved backend at the entry's mount path in ZenFS

#### Scenario: Unmount an entry
- **WHEN** the user sets a mounted entry to unmounted
- **THEN** the system unmounts the backend from ZenFS but keeps the entry and its `BackendConfig` in IndexedDB

#### Scenario: Mount FSA entry with stale permission
- **WHEN** the user mounts an FSA entry whose handle permission was revoked
- **THEN** `resolveBackendConfig()` detects the denied permission and throws a `BackendValidationError`
- **AND** the entry remains unmounted and the user is shown an error message

### Requirement: Auto-mount on app load
The system SHALL automatically mount all entries that have `mounted: true` when the app initializes.

#### Scenario: Restore mounts on startup
- **WHEN** the app loads and mount entries are restored from IndexedDB
- **THEN** each entry with `mounted: true` is mounted in ZenFS; entries where permission is denied are silently unmounted

### Requirement: Mount path uniqueness
The system SHALL enforce that each mount entry has a unique mount path.

#### Scenario: Duplicate mount path rejected
- **WHEN** the user tries to add a mount with a mount path that already exists
- **THEN** the system rejects the entry and shows an error message
