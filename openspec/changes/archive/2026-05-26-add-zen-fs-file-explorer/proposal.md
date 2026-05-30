## Why

Exstudeo needs a way for users to browse and open their local note and book files. Currently the app has no file access capability — it's a blank shell. Adding ZenFS with the File System Access API lets users pick a directory, persist that choice across sessions, and browse files through a table-form file explorer. This is the foundation for all future reader features.

## What Changes

- **New dependencies**: `@zenfs/core` and `@zenfs/dom` added to `apps/web`
- **Tabbed app shell**: The main app becomes tab-driven using React Router + shadcn Tabs. A "Files" tab provides the file explorer.
- **File System Access API integration**: Users pick a directory via `showDirectoryPicker()`. The handle is stored in IndexedDB for persistence across sessions.
- **Multiple mount support**: Users can store multiple directory handles in a list (each with a mount path and label). One or more can be mounted simultaneously under the ZenFS root `/`.
- **Dynamic mount lifecycle**: Mount (activate), unmount (deactivate without deleting handle), and remove (permanently delete from IndexedDB).
- **Global ZenFS singleton**: A `lib/zenfs.ts` module configures and re-exports the ZenFS `fs` and `promises` APIs for use throughout the app.
- **Browse-only file explorer**: A table-form listing (name, size, type, modified) that shows the ZenFS root `/` — all mounted directories appear as top-level folders. User can navigate into directories. No CRUD operations in this change.
- **shadcn components added**: `tabs`, `table`, `dialog`, `dropdown-menu`, `breadcrumb`
- **Service worker**: Updated to cache the new UI shell assets (already handled by injectManifest, but new routes need verification).

## Capabilities

### New Capabilities

- `mount-management`: Managing a persisted list of directory handles — add, mount, unmount, remove. Each entry has an id, user label, mount path, and FileSystemDirectoryHandle.
- `zenfs-integration`: Configuring and exposing the global ZenFS singleton (`lib/zenfs.ts`). Mounting/unmounting backends at runtime. Error handling for permission loss.
- `file-explorer`: Browsing the ZenFS virtual filesystem. Table-form display of directory contents. Directory navigation. Sorting by name/size/type/date.
- `tabbed-shell`: React Router + shadcn Tabs layout. URL-driven tab selection. Placeholder tab for future reader.

### Modified Capabilities

*(None — no existing specs to modify.)*

## Impact

- **apps/web**: New dependencies, new components (`file-explorer/`, `layout/`), new lib modules (`zenfs.ts`, `mount-store.ts`), new hooks (`use-zenfs.ts`)
- **packages/ui**: New shadcn components added (tabs, table, dialog, dropdown-menu, breadcrumb)
- **Service worker**: Existing precaching handles new assets automatically; no SW logic changes needed
- **No breaking changes**: This is additive — existing behavior (theme toggle, dark mode) unaffected