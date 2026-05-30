## Context

Exstudeo is a Vite 7 + React 19 PWA with a shadcn/ui component library. Currently it has no file access capability — the app renders a welcome screen and a theme toggle. The user wants to browse local note files via the File System Access API, with persistence across sessions and support for multiple directory handles.

ZenFS (`@zenfs/core` + `@zenfs/dom`) provides a POSIX-like virtual filesystem layer over browser storage APIs. The `WebAccess` backend wraps a `FileSystemDirectoryHandle` (from `showDirectoryPicker()`) and presents it as a Unix-like filesystem with `fs.readdirSync()`, `fs.readFileSync()`, etc. This eliminates the need to hand-roll FSA adapter code.

## Goals / Non-Goals

**Goals:**

- Users can pick one or more local directories and have them appear as browsable virtual filesystems
- Directory handles persist across sessions via IndexedDB
- A tabbed app shell with a working "Files" tab showing a table-form file explorer
- Dynamic mount/unmount/remove of directory handles at runtime
- Global singleton access to ZenFS `fs` and `promises` APIs from any module
- File explorer shows ZenFS root `/` — all mounted backends appear as top-level directories

**Non-Goals:**

- File CRUD operations (rename, delete, create) — browse-only
- File preview or reader tabs — those are future changes
- Drag-and-drop file import
- Syncing or remote backends
- Safari/Firefox support for File System Access API (Chromium-only)

## Decisions

### D1: ZenFS over raw File System Access API

**Chosen**: `@zenfs/core` + `@zenfs/dom` WebAccess backend

**Alternatives considered**: Raw FSA API directly in components

**Rationale**: ZenFS provides a POSIX filesystem API (`readdirSync`, `readFileSync`, `stat`) that is far more ergonomic than the raw `FileSystemDirectoryHandle.entries()` async iterator. It also handles caching, metadata indexing, and permission re-acquisition. Using it directly avoids reinventing a filesystem abstraction layer. The library is mature (v2.5.6, 397 stars, LGPL).

**Type story**: ZenFS exports `Backend`, `BackendConfiguration`, `MountConfiguration`, and the `FileSystem` class hierarchy. The `Backend` interface is:

```ts
interface Backend<FS extends FileSystem, TOptions extends object> {
  name: string;
  options: OptionsConfig<TOptions>;
  create(options: TOptions & Partial<SharedConfig>): FS | Promise<FS>;
}
```

The `WebAccess` backend has `WebAccessOptions = { handle: FileSystemDirectoryHandle; metadata?: string; disableHandleCache?: boolean }`.

### D2: Module-level singleton over React context for ZenFS access

**Chosen**: `lib/zenfs.ts` as a module singleton

**Alternatives considered**: React Context provider wrapping the app

**Rationale**: ZenFS's `fs` and `promises` APIs are used from both components and utility functions. A module singleton is simpler, avoids nesting, and doesn't require a provider at the root. React components access it via `import { fs } from '@/lib/zenfs'`. The singleton state (mount status, active backends) is exported as reactive signals that components can watch.

### D3: URL-driven tabs with React Router

**Chosen**: React Router v7 (bundled with Vite) with routes `/files`, `/reader` (placeholder)

**Rationale**: URL-driven tabs enable deep-linking to the file explorer, browser back/forward navigation, and a clear separation of tab state from UI state. The file explorer's **internal navigation** (which directory you're inside) is managed via local React state, not the URL — avoiding overly complex route structures.

**shadcn component**: `tabs` from shadcn/ui wraps the tab bar and tab panels, synced to the current route via a custom hook.

### D4: IndexedDB for handle persistence

**Chosen**: Raw IndexedDB via a small `mount-store.ts` module (no additional library)

**Alternatives considered**: `idb-keyval`, `@zenfs/dom` IndexedDB backend, `localStorage`

**Rationale**: `FileSystemDirectoryHandle` supports structured cloning and can be stored directly in IndexedDB. The API surface is small (CRUD on a list of mount entries) — wrapping raw IndexedDB is straightforward and avoids an extra dependency. `localStorage` cannot store `FileSystemDirectoryHandle` objects (quota limits, structured clone issues). ZenFS's own IndexedDB backend is for file content, not handle metadata.

### D5: Mount entry data model

```ts
interface MountEntry {
  id: string;                    // crypto.randomUUID()
  name: string;                  // user-given label, e.g., "My Notes"
  mountPath: string;             // e.g., "/notes" — must be unique across entries
  handle: FileSystemDirectoryHandle;  // the FSA handle
}
```

Stored in IndexedDB under a single object store `mounts` keyed by `id`. When the app loads, all stored entries with `status: 'active'` (or a separate active flag) get mounted via `configure()`.

Actually — mounts are dynamic, so the data model needs a `mounted` boolean:

```ts
interface MountEntry {
  id: string;
  name: string;
  mountPath: string;
  handle: FileSystemDirectoryHandle;
  mounted: boolean;   // whether it's currently mounted in ZenFS
}
```

### D6: shadcn components to add

| Component | CLI command | Purpose |
|-----------|-------------|---------|
| `tabs` | `npm exec shadcn@latest add tabs -c apps/web` | Tab bar + panels |
| `table` | `npm exec shadcn@latest add table -c apps/web` | File listing grid |
| `dialog` | `npm exec shadcn@latest add dialog -c apps/web` | Add/remove mount confirmation |
| `dropdown-menu` | `npm exec shadcn@latest add dropdown-menu -c apps/web` | Context actions per mount |
| `breadcrumb` | `npm exec shadcn@latest add breadcrumb -c apps/web` | Path navigation in explorer |

### D7: File structure

```
apps/web/src/
├── lib/
│   ├── zenfs.ts             ← Singleton: configure, mount, unmount, re-exports
│   └── mount-store.ts       ← IndexedDB persistence for MountEntry[]
├── hooks/
│   └── use-zenfs.ts         ← Hook exposing fs, mount list, loading/error state
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx    ← Tab bar (shadcn Tabs) + outlet
│   │   └── mounts-dialog.tsx ← Dialog for adding/removing/managing mounts
│   └── file-explorer/
│       ├── page.tsx          ← Route component for /files
│       ├── directory-table.tsx  ← shadcn Table of file entries
│       └── path-breadcrumb.tsx  ← shadcn Breadcrumb for current dir
└── App.tsx                   ← React Router setup with BrowserRouter
```

### D8: Lifecycle flow

```
App Start
  │
  ├─ mount-store.ts reads IndexedDB → MountEntry[]
  │
  ├─ zenfs.ts.configure(entries.filter(e => e.mounted))
  │     → WebAccess backends mounted at each entry's mountPath
  │     → ZenFS root "/" shows: /notes, /books, etc.
  │
  └─ React Router renders <AppShell>
        └─ Tab "/files" → <FileExplorerPage>
              ├─ lib/zenfs.fs.readdirSync("/") → show mount points
              ├─ Navigate into mount → readdir relative to mount path
              └─ Mounts dialog: add/remove/mount/unmount
```

### D9: Service worker compatibility

The existing SW precaches the app shell. Since ZenFS operates on the main thread with the `FileSystemDirectoryHandle` (which cannot be transferred to the SW), the SW remains unchanged. New route chunks (`/files`) are automatically handled by Vite's code splitting + the existing injectManifest precaching.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| **Browser support**: File System Access API is Chromium-only. Safari/Firefox users get an empty app. | Acceptable for now — target audience is desktop Chromium. A fallback (IndexedDB backend + file import) can be added later as a separate change. |
| **Handle permission loss**: The browser may revoke the directory handle permission on reload. | `mount-store.ts` must re-verify permission via `handle.requestPermission()` before mounting. If denied, mark as unmounted and surface to user. |
| **Large directories**: ZenFS's `_loadHandles` recursively iterates all entries on init, which could be slow for 10K+ files. | Acceptable for v1. If performance issues arise, the `_handles` cache can be seeded lazily. |
| **External file changes**: If the user edits a file externally while the app is open, ZenFS's handle cache may serve stale `stat` data. | ZenFS handles this partially — `stat()` falls back to FSA on ENOENT. Full invalidation would require a file watcher API, which FSA doesn't support. User can re-mount to refresh. |
| **IndexedDB quota**: Large numbers of stored handles or metadata could hit browser storage limits. | Handle metadata is tiny — the `FileSystemDirectoryHandle` itself has no size. Not a practical concern. |

## Open Questions

- What should the default mount path be when the user adds a new directory? Auto-generate from the directory name? (e.g., picking "Documents/Notes" → mount path `/notes`)
A: Prompt User for a path of mounting, by default mount path `/localhost` (be sure to valiated the path!)

- Should unmounting temporarily hide the entry from the ZenFS root, or show it greyed out?
A: greyed out
