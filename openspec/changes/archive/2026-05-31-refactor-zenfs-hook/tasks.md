## 1. Extract standalone mutator functions

- [x] 1.1 Create `addMountEntry`, `toggleMountEntry`, `removeMountEntry`, `reconnectMountEntry` as exported async functions in `lib/zenfs.ts`, extracting the logic currently in `use-zenfs.ts` callbacks (each combines `mount-store` persistence + ZenFS operations + `notify()`)
- [x] 1.2 Add TSDoc to each standalone mutator function

## 2. Refactor hook to useZenFSSnapshot

- [x] 2.1 Rename `useZenFS` to `useZenFSSnapshot` in `hooks/use-zenfs.ts`
- [x] 2.2 Remove `fs`, `promises`, and mutator callbacks from the return type
- [x] 2.3 Wrap returned object in `useMemo` keyed on `snapshot.entries` and `snapshot.deniedEntries`
- [x] 2.4 Rename interface from `ZenFSState` to `ZenFSSnapshot` with only `{ entries, deniedEntries, hasEntries }`
- [x] 2.5 Remove `useCallback` imports no longer needed

## 3. Update MountsDialog

- [x] 3.1 Simplify props interface to `{ entries, deniedEntries }` — remove `toggleMount`, `removeMount`, `reconnectMount`
- [x] 3.2 Import standalone mutators from `@/lib/zenfs` directly
- [x] 3.3 Remove the `useEffect(() => {}, [zenfs.entries])` force-re-render hack
- [x] 3.4 Update `AddMountForm` to use `addMountEntry()` instead of ad-hoc `persistMount` + `mountBackend`
- [x] 3.5 Remove unused imports (`mountBackend`, `saveMount` from mount-store)

## 4. Update page consumers

- [x] 4.1 Update `FileExplorerPage` to use `useZenFSSnapshot()`, import `promises` from `@/lib/zenfs` directly for FS calls
- [x] 4.2 Update `EpubExplorerPage` to use `useZenFSSnapshot()`, import `promises` from `@/lib/zenfs` directly for the `EpubContextProvider` prop
- [x] 4.3 Verify all `zenfs.fs.promises.*` call sites are replaced with `promises.*`

## 5. Cleanup and verify

- [x] 5.1 Remove dead `ZenFSState` type references from imports across the codebase
- [x] 5.2 Run TypeScript check (`tsc -b`) and fix any type errors
- [x] 5.3 Run tests (`npm run test`) to confirm no regressions
- [x] 5.4 Run build (`npm run build`) to confirm everything compiles