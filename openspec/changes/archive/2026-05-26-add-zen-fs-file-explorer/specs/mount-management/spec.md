## ADDED Requirements

### Requirement: User can add a directory mount
The system SHALL allow the user to add a new directory handle by picking a directory via the File System Access API (`showDirectoryPicker`). Each mount entry SHALL store an id, user-given name, mount path, and the directory handle.

#### Scenario: Add new mount from picker
- **WHEN** the user clicks "Add Directory" and selects a folder via the native picker
- **THEN** the system creates a `MountEntry` with a unique id, the directory's name as default label, an auto-generated mount path, and the handle set to `mounted: true`

#### Scenario: Add mount with custom name
- **WHEN** the user clicks "Add Directory" and the system prompts for a label
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
The system SHALL allow the user to toggle a mount entry between mounted and unmounted states at runtime without deleting the stored handle.

#### Scenario: Mount an entry
- **WHEN** the user sets a stored entry to mounted
- **THEN** the system configures a `WebAccess` backend with the entry's handle and mounts it at the entry's mount path in ZenFS

#### Scenario: Unmount an entry
- **WHEN** the user sets a mounted entry to unmounted
- **THEN** the system unmounts the backend from ZenFS but keeps the entry and handle in IndexedDB

#### Scenario: Mount with stale permission
- **WHEN** the user mounts an entry whose handle permission was revoked
- **THEN** the system calls `handle.requestPermission()`; if denied, the entry remains unmounted and the user is shown an error message

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