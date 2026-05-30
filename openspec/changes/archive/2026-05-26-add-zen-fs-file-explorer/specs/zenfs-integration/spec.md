## ADDED Requirements

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