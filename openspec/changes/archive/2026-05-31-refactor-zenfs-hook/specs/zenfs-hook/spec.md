## ADDED Requirements

### Requirement: useZenFSSnapshot hook provides read-only reactive mount state
The system SHALL provide a `useZenFSSnapshot()` React hook that returns only reactive mount state — `{ entries, deniedEntries, hasEntries }` — using `useSyncExternalStore` with `subscribe`/`getSnapshot` from `lib/zenfs.ts`. The returned object SHALL be wrapped in `useMemo` keyed on the snapshot values so that the reference is stable across renders when state has not changed.

#### Scenario: Hook returns entries
- **WHEN** `useZenFSSnapshot()` is called in a React component
- **THEN** the returned object contains `entries: MountEntry[]` reflecting all current mount entries

#### Scenario: Hook returns denied entries
- **WHEN** `useZenFSSnapshot()` is called in a React component
- **THEN** the returned object contains `deniedEntries: ReadonlyMap<string, string>` reflecting all currently denied entries

#### Scenario: Hook returns hasEntries
- **WHEN** `useZenFSSnapshot()` is called in a React component
- **THEN** the returned object contains `hasEntries: boolean` that is `true` when `entries.length > 0`

#### Scenario: Stable reference when state unchanged
- **WHEN** `useZenFSSnapshot()` is called across multiple renders without any mount state change
- **THEN** the returned object has the same reference identity (`===`) across those renders

#### Scenario: New reference when entries change
- **WHEN** a mount entry is added, removed, mounted, or unmounted
- **THEN** a subsequent render of a component using `useZenFSSnapshot()` receives a new object reference

#### Scenario: Hook does not expose fs or promises
- **WHEN** `useZenFSSnapshot()` is called in a React component
- **THEN** the returned object does NOT contain `fs` or `promises` properties

### Requirement: Standalone mount mutator functions in lib/zenfs.ts
The system SHALL provide standalone async functions `addMountEntry`, `toggleMountEntry`, `removeMountEntry`, and `reconnectMountEntry` exported from `lib/zenfs.ts`. Each function SHALL combine persistence (via `lib/mount-store`) with ZenFS operations (mount/unmount/reconnect) and call `notify()` to trigger reactive updates.

#### Scenario: addMountEntry persists and mounts
- **WHEN** `addMountEntry(entry)` is called with a `MountEntry` where `mounted: true`
- **THEN** the entry is persisted to IndexedDB via `saveMount()`
- **AND** the entry is mounted in ZenFS via `mountBackend()`
- **AND** `notify()` is called so `useZenFSSnapshot()` consumers re-render

#### Scenario: addMountEntry persists unmounted entry
- **WHEN** `addMountEntry(entry)` is called with a `MountEntry` where `mounted: false`
- **THEN** the entry is persisted to IndexedDB via `saveMount()`
- **AND** the entry is registered in state via `registerMountEntry()` without mounting in ZenFS
- **AND** `notify()` is called

#### Scenario: toggleMountEntry mounts an unmounted entry
- **WHEN** `toggleMountEntry(entry)` is called where `entry.mounted` is `false`
- **THEN** the backend is mounted via `mountBackend()`
- **AND** the persisted entry is updated via `updateMount(id, { mounted: true })`

#### Scenario: toggleMountEntry unmounts a mounted entry
- **WHEN** `toggleMountEntry(entry)` is called where `entry.mounted` is `true`
- **THEN** the backend is unmounted via `unmountBackend()`
- **AND** the persisted entry is updated via `updateMount(id, { mounted: false })`

#### Scenario: removeMountEntry deletes and deregisters
- **WHEN** `removeMountEntry(id)` is called
- **THEN** if the entry is mounted, it is unmounted via `unmountBackend()`
- **AND** the entry is deleted from IndexedDB via `deleteMount()`
- **AND** the entry is deregistered from state via `deregisterMountEntry()`

#### Scenario: reconnectMountEntry delegates to reconnectMount
- **WHEN** `reconnectMountEntry(id)` is called
- **THEN** it delegates to the existing `reconnectMount(id)` function which re-validates and remounts

## MODIFIED Requirements

### Requirement: Expose mount state reactively
The system SHALL expose the current mount state (list of mount entries, which are mounted, denied entries with reasons) via the `useZenFSSnapshot()` React hook, which uses `useSyncExternalStore` with `subscribe`/`getSnapshot` from `lib/zenfs.ts`. The returned object SHALL be wrapped in `useMemo` for reference stability and SHALL NOT include `fs`, `promises`, or mutator callbacks.

#### Scenario: Component observes mount changes
- **WHEN** a mount entry is added, removed, mounted, or unmounted
- **THEN** React components using `useZenFSSnapshot()` re-render with the updated state

#### Scenario: Component observes denied entries
- **WHEN** an entry fails to mount and is added to `deniedEntries`
- **THEN** React components using `useZenFSSnapshot()` receive the updated `deniedEntries` map

#### Scenario: Hook does not expose imperative mutators
- **WHEN** `useZenFSSnapshot()` is called
- **THEN** the returned object does NOT contain `addMount`, `toggleMount`, `removeMount`, or `reconnectMount` methods

#### Scenario: Hook does not expose fs or promises
- **WHEN** `useZenFSSnapshot()` is called
- **THEN** the returned object does NOT contain `fs` or `promises` properties

### Requirement: Global ZenFS singleton
The system SHALL provide a global singleton module (`lib/zenfs.ts`) that configures ZenFS using `resolveBackendConfig()` to support multiple backend types, and re-exports the `fs` and `promises` APIs for use throughout the application. The module SHALL also export standalone mutator functions (`addMountEntry`, `toggleMountEntry`, `removeMountEntry`, `reconnectMountEntry`) that combine persistence with ZenFS operations.

#### Scenario: Module exports fs and promises
- **WHEN** any module imports from `@/lib/zenfs`
- **THEN** it receives the configured `fs` (sync API) and `promises` (async API) objects

#### Scenario: Module exports standalone mutator functions
- **WHEN** any module imports from `@/lib/zenfs`
- **THEN** it receives the `addMountEntry`, `toggleMountEntry`, `removeMountEntry`, and `reconnectMountEntry` functions

#### Scenario: Configure with mounts of any backend type
- **WHEN** `mountBackend()` is called with a `MountEntry` containing a `BackendConfig`
- **THEN** the entry's backend is resolved via `resolveBackendConfig(entry.backend)` and mounted at its `mountPath`
- **AND** `fs.readdirSync('/')` returns the mount point directories regardless of backend type