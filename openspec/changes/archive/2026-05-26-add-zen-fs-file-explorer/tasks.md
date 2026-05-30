## 1. Dependencies & Setup

- [x] 1.1 Install `@zenfs/core` and `@zenfs/dom` in `apps/web`
- [x] 1.2 Install `react-router` in `apps/web` (if not already added by shadcn preset)
- [x] 1.3 Add shadcn components: `npm exec shadcn@latest add tabs -c apps/web`
- [x] 1.4 Add shadcn components: `npm exec shadcn@latest add table -c apps/web`
- [x] 1.5 Add shadcn components: `npm exec shadcn@latest add dialog -c apps/web`
- [x] 1.6 Add shadcn components: `npm exec shadcn@latest add dropdown-menu -c apps/web`
- [x] 1.7 Add shadcn components: `npm exec shadcn@latest add breadcrumb -c apps/web`

## 2. Core Library — Mount Store (IndexedDB Persistence)

- [x] 2.1 Create `src/lib/mount-store.ts` with the `MountEntry` interface and IndexedDB schema (object store `mounts` keyed by `id`)
- [x] 2.2 Implement `loadMounts()` — reads all entries from IndexedDB
- [x] 2.3 Implement `saveMount(entry)` — adds a new mount entry to IndexedDB
- [x] 2.4 Implement `updateMount(id, partial)` — updates mount/unmount state or other fields
- [x] 2.5 Implement `deleteMount(id)` — permanently removes entry from IndexedDB
- [x] 2.6 Implement `requestHandlePermission(handle)` — verifies/re-acquires FSA permission

## 3. Core Library — ZenFS Singleton

- [x] 3.1 Create `src/lib/zenfs.ts` with a module-level singleton that imports from `@zenfs/core` and `@zenfs/dom`
- [x] 3.2 Implement `configure(mounts: MountEntry[])` — configures ZenFS with `WebAccess` backends for all mounted entries
- [x] 3.3 Implement `mountBackend(entry: MountEntry)` — mounts a single backend dynamically at runtime
- [x] 3.4 Implement `unmountBackend(entry: MountEntry)` — unmounts a single backend dynamically
- [x] 3.5 Re-export `fs` (sync API) and `promises` (async API) from the singleton
- [x] 3.6 Expose reactive mount state (event emitter or simple callback pattern) for UI components

## 4. React Integration Hook

- [x] 4.1 Create `src/hooks/use-zenfs.ts` with a hook that provides `fs`, `promises`, mount list, and loading/error states
- [x] 4.2 Hook subscribes to ZenFS singleton state changes and triggers re-renders

## 5. Tabbed App Shell

- [x] 5.1 Set up React Router with `BrowserRouter` in `App.tsx` — routes for `/`, `/files`, and `/reader`
- [x] 5.2 Create `src/components/layout/app-shell.tsx` with shadcn `Tabs` synced to the current route
- [x] 5.3 Tab bar shows "Files" tab (selected by default) and placeholder "Reader" tab
- [x] 5.4 Tab click updates the URL via React Router navigation
- [x] 5.5 App shell reads mount state on init, calls `zenfs.configure()` on first load

## 6. File Explorer Components

- [x] 6.1 Create `src/components/layout/mounts-dialog.tsx` — dialog for managing mounts (add, remove, mount/unmount toggle)
- [x] 6.2 Mounts dialog uses `showDirectoryPicker()` for adding new directories
- [x] 6.3 Create `src/components/file-explorer/page.tsx` — route component that reads current directory from local state and renders the explorer
- [x] 6.4 Create `src/components/file-explorer/directory-table.tsx` — shadcn `Table` showing file entries with columns: Name, Size, Type, Modified; with column sorting
- [x] 6.5 Create `src/components/file-explorer/path-breadcrumb.tsx` — shadcn `Breadcrumb` for current directory path with clickable segments
- [x] 6.6 Directory table shows `..` parent entry for navigation
- [x] 6.7 Click on file entry logs the file path (stub for future reader)
- [x] 6.8 Empty state rendered when no mounts are active

## 7. Wire Up & Verify

- [x] 7.1 Wire `App.tsx` to render `<AppShell>` with `<Routes>` for `/files` and `/reader`
- [x] 7.2 Verify `npm run dev` starts without errors
- [x] 7.3 Verify `npm run typecheck` passes
- [x] 7.4 Verify shadcn `Tabs` + React Router integration works (URL changes on tab click)
- [x] 7.5 Verify file explorer mounts and browses a real directory

## 8. Documentation

- [x] 8.1 Update `apps/web/readme.md` with new capabilities (tabbed shell, file explorer, ZenFS)
- [x] 8.2 Append entry to `Development.log.md` describing the change