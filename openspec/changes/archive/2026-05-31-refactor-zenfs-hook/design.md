## Context

The `useZenFS()` hook currently bundles three unrelated concerns: reactive state snapshots from `useSyncExternalStore`, global ZenFS singletons (`fs`/`promises`), and mutator callbacks (`addMount`, `toggleMount`, `removeMount`, `reconnectMount`). This makes the returned object a kitchen-sink interface — every consumer pulls in data it doesn't need. The hook also lacks `useMemo`, causing a new reference object on every render even when the underlying state hasn't changed.

Additionally, `MountsDialog` uses `useEffect(() => {}, [zenfs.entries])` as a force-rerender anti-pattern, and `AddMountForm` bypasses the hook's `addMount` entirely by calling `mountBackend()` and `saveMount()` directly — making the hook's mutator dead code for its own primary consumer.

## Goals / Non-Goals

**Goals:**
- Separate read-only reactive state (`useZenFSSnapshot`) from imperative mutator functions
- Remove `fs`/`promises` from the hook — they're static singletons, consumers import directly
- Stabilize the hook return value with `useMemo`
- Unify mount persistence + ZenFS wiring into standalone composed functions usable by both the dialog and future consumers
- Eliminate the `useEffect(() => {}, [zenfs.entries])` force-re-render hack

**Non-Goals:**
- Changing the ZenFS singleton architecture
- Altering the `ViewModel` or `EpubContextProvider` internals
- Adding caching, logging, or error enrichment to FS operations (thin delegation, not enriched)
- Renaming the module or changing the mount/notify system

## Decisions

### Decision 1: Standalone mutator functions in `lib/zenfs.ts`

**Choice**: Extract `addMountEntry`, `toggleMountEntry`, `removeMountEntry`, `reconnectMountEntry` as standalone async functions exported from `lib/zenfs.ts`.

**Rationale**: These functions already compose `lib/mount-store` calls (IndexedDB persistence) + `lib/zenfs` calls (ZenFS mount/unmount) + `notify()`. The React hook was a thin wrapper — it had no React-specific logic. Moving them to the module eliminates the indirection and lets both `MountsDialog` and `AddMountForm` call the same functions.

**Alternatives considered**:
- Keep mutators in the hook but add `useMemo`: no — doesn't fix `AddMountForm` bypassing them.
- Pass mutators as props to `MountsDialog`: no — props are the right pattern for widget configuration, not for domain-level imperative actions. Importing them directly is simpler and avoids prop-drilling.

### Decision 2: `useZenFSSnapshot()` returns only reactive state

**Choice**: The hook returns `{ entries, deniedEntries, hasEntries }` wrapped in `useMemo` keyed on the snapshot values.

**Rationale**: `useSyncExternalStore` already guarantees re-renders when the snapshot reference changes. `useMemo` stabilizes the returned object reference so children receive consistent props unless state actually changed. This eliminates the need for `MountsDialog`'s force-rerender effect.

**Type**:
```ts
interface ZenFSSnapshot {
  entries: MountEntry[]
  deniedEntries: ReadonlyMap<string, string>
  hasEntries: boolean
}
```

### Decision 3: Consumers import `fs`/`promises` directly

**Choice**: `FileExplorerPage` and `EpubExplorerPage` import `{ promises }` from `@/lib/zenfs` directly rather than receiving it through the hook.

**Rationale**: `fs` and `promises` are immutable global singletons from `@zenfs/core`. Their internal state is managed by ZenFS's `mount()`/`umount()` — not by the hook. Passing them through the hook misleadingly implies the hook owns or manages them.

### Decision 4: `MountsDialog` props simplified

**Choice**: `MountsDialog` accepts `{ entries, deniedEntries }` instead of `Pick<ZenFSState, "entries" | "toggleMount" | "removeMount" | "deniedEntries" | "reconnectMount">`.

**Rationale**: The dialog no longer needs callbacks passed as props — it imports mutators directly from `lib/zenfs.ts`. This reduces prop surface and eliminates the tight coupling between the hook interface and the component props.

## Risks / Trade-offs

- **[Risk] Importing mutators directly makes them harder to mock in tests** → Mitigation: These are already not mocked — tests use the real ZenFS singleton. No regression.
- **[Risk] `useMemo` depends on correct memo deps** → Mitigation: The deps are `snapshot.entries` and `snapshot.deniedEntries` — both are fresh references from `notify()`, guaranteed by existing spec.
- **[Risk] Breaking change to hook name** → Mitigation: Only 3 call sites (`FileExplorerPage`, `EpubExplorerPage`, `MountsDialog`). All in the same app, zero external consumers.