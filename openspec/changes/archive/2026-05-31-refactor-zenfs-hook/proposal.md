## Why

The `useZenFS()` hook has grown into a kitchen-sink interface that bundles read-only reactive state (`entries`, `deniedEntries`), stateless global singletons (`fs`, `promises`), and mutator callbacks (`addMount`, `toggleMount`, etc.). This conflates three distinct concerns, creates misleading ownership semantics (the hook appears to manage `fs`/`promises` but they're immutable globals), leaks a stale anti-pattern (`useEffect(() => {}, [zenfs.entries])` in `MountsDialog`), and produces a new object on every render (no `useMemo`). Additionally, `AddMountForm` bypasses the hook's mutators entirely by calling `mountBackend()`/`saveMount()` directly — the hook's `addMount` is dead code for its primary consumer.

## What Changes

- **BREAKING**: Rename `useZenFS()` to `useZenFSSnapshot()` — returns only `{ entries, deniedEntries, hasEntries }` with stable reference via `useMemo`
- Remove `fs` and `promises` from the hook return type — consumers import them directly from `@/lib/zenfs`
- Extract `addMount`, `toggleMount`, `removeMount`, `reconnectMount` from the hook into standalone exported functions in `lib/zenfs.ts`
- Simplify `MountsDialog` props from `Pick<ZenFSState, ...>` to `{ entries, deniedEntries }` — import mutators directly
- Remove the `useEffect(() => {}, [zenfs.entries])` anti-pattern from `MountsDialog`
- Fix `AddMountForm` to use the unified `addMountEntry()` function instead of ad-hoc `persistMount` + `mountBackend`
- `FileExplorerPage` imports `promises` from `@/lib/zenfs` directly for `readdir`/`stat` calls
- `EpubContextProvider` receives `promises` from its parent (which imports it directly), no longer through a hook

## Capabilities

### New Capabilities
- `zenfs-hook`: Defines `useZenFSSnapshot()` as a read-only reactive hook for mount state, and standalone mutator functions (`addMountEntry`, `toggleMountEntry`, `removeMountEntry`, `reconnectMountEntry`) that combine persistence + ZenFS operations into cohesive units

### Modified Capabilities
<!-- No spec-level requirement changes. The zenfs-integration and epub-explorer specs already describe the correct contract — this refactor aligns implementation with those specs. -->

## Impact

- **Hook**: `hooks/use-zenfs.ts` — renamed, interface shrunk, `useMemo` added
- **ZenFS lib**: `lib/zenfs.ts` — gains four composed mutator functions extracted from the old hook
- **MountsDialog**: `components/layout/mounts-dialog.tsx` — simplified props, direct mutator imports, no stale effect
- **FileExplorerPage**: `components/file-explorer/page.tsx` — imports `promises` directly
- **EpubExplorerPage**: `components/epub-explorer/page.tsx` — imports `promises` directly
- **ViewModel / EpubContext**: no code change — already accepts `promises` as a parameter; only call site changes
- **Type**: `ZenFSState` interface — simplified to `{ entries, deniedEntries, hasEntries }` only