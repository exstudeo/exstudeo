# Web App — Developer Reference

## Overview

The `apps/web` package is a Vite 7 + React 19 PWA. It serves as the reader UI for Exstudeo, consuming shared components from `@workspace/ui`.

## Current State

- React 19 with StrictMode
- TypeScript strict mode with `verbatimModuleSyntax`
- Tailwind CSS 4 via Vite plugin
- shadcn/ui base-nova theming with RTL support
- Path alias `@/` mapped to `src/`
- Dark/light/system theme via `ThemeProvider`
- **PWA**: Service worker (injectManifest) precaches app shell; three-tier routing (SPA redirect → validation → 404) via shared `route.path.ts`; cold-visit handling via `404.html`; manifest auto-generated; active in dev mode
- **Routing**: React Router v7 with tabbed app shell (Tabs + TabsContent) — client-side navigation via `<BrowserRouter>`, redirect handler on boot for `?redirect=` params, catch-all for unmatched paths
- **File system**: ZenFS (`@zenfs/core` + `@zenfs/dom`) provides a POSIX virtual filesystem over the File System Access API
- **Mount management**: Users add, mount/unmount, and remove directory handles, persisted in IndexedDB
- **File explorer**: Table-form directory browser with column sorting, breadcrumb navigation, and empty state
- **Tests**: Vitest + React Testing Library + jest-dom; co-located `.test.tsx` files

## Planned Features

- **Format rendering**: Markdown and EPUB reader views (reader tab is a placeholder)
- **State management**: To be determined
- **Backend integration**: IndexedDB for local storage, sync later

## Source Map

```
src/
├── route.path.ts                # Shared SPA route definitions (SPA_ROUTES, isSpaRoutePath)
├── sw.ts                        # Service worker (injectManifest, three-tier routing)
├── main.tsx                     # Entry point — mounts React app
├── App.tsx                      # Root component (React Router + RedirectHandler)
├── sw-templates/
│   ├── sw-not-found.html        # SW 404 page template ({{url}})
│   └── sw-validate.html         # SW diagnostic page template ({{requestInfo}})
├── public/
│   └── 404.html                 # Cold-visit redirect (captures path+hash → ?redirect=&fragment=)
├── lib/
│   ├── zenfs.ts                 # ZenFS singleton (configure, mount/unmount, reactive)
│   ├── mount-store.ts           # IndexedDB mount persistence (CRUD + permission helpers)
│   ├── redirect-handler.ts      # Parses ?redirect= / ?fragment= on boot
│   ├── fsa-types.d.ts           # File System Access API type augmentations for TS 5.9
│   └── utils.test.ts            # Co-located tests
├── hooks/
│   └── use-zenfs.ts             # React hook (useSyncExternalStore) for ZenFS state
├── components/
│   ├── theme-provider.tsx       # Dark/light/system theme
│   ├── theme-provider.test.tsx
│   ├── layout/
│   │   ├── app-shell.tsx        # Tabbed shell (Tabs + Outlet, StrictMode-safe)
│   │   └── mounts-dialog.tsx    # Mount management dialog (add, toggle, remove)
│   ├── file-explorer/
│   │   ├── page.tsx             # File explorer route component
│   │   ├── directory-table.tsx  # Sortable file table (Name/Size/Type/Modified)
│   │   └── path-breadcrumb.tsx  # Breadcrumb navigation
│   └── reader/
│       └── page.tsx             # Placeholder reader page
└── test/
    └── setup.ts                 # Test setup (jest-dom + matchMedia polyfill)
```

## Service Worker Behaviour

The service worker at `src/sw.ts` uses **injectManifest** strategy (build-time manifest injection) with these behaviours:

- **Precaching**: Caches all JS, CSS, HTML, JSON, PNG, SVG, ICO, and WOFF2 assets from the build output
- **Three-tier routing**: The old flat `NavigationRoute` 404 is replaced by a three-tier strategy:
  1. **SPA redirect handler** — intercepts navigations to known SPA routes (`/files`, `/reader`) using path-segment matching (`isSpaRoutePath()`), responds with 302 redirect to `/?redirect=...&fragment=...` so the app can navigate client-side
  2. **Validation page handler** — serves a diagnostic JSON dump at `/validate_service_worker.html`
  3. **404 catch-all** — uses a callback matcher (not `NavigationRoute`) that catches only genuinely unknown routes, exempting root path, SPA routes, and the validation route
- **Shared route definitions**: `src/route.path.ts` exports `SPA_ROUTES` and `isSpaRoutePath()` — imported by both `App.tsx` (for React Router paths) and `sw.ts` (for SW routing)
- **HTML templates**: SW-served pages (`sw-not-found.html`, `sw-validate.html`) live in `src/sw-templates/` and are imported via `?raw` with `{{key}}` placeholder interpolation
- **Cold-visit handling**: `public/404.html` reads `location.pathname + location.search + location.hash` and redirects to `/?redirect=...&fragment=...` (with `<noscript>` meta-refresh fallback)
- **App redirect handler**: `App.tsx` has a `RedirectHandler` component that parses `?redirect=` and `?fragment=` on boot, matches against `SPA_ROUTES`, and either navigates client-side (known route) or redirects fully (unknown route)
- **Dev mode guard**: When `self.__WB_MANIFEST` is empty (dev mode), precaching and all custom route handlers are skipped, letting the Vite dev server handle all requests
- **Auto-update**: `skipWaiting()` on install + `clients.claim()` on activate — new SW takes control immediately without user prompts

## Routing Architecture

The app uses React Router v7 with a layout route pattern. SPA route paths are defined in a shared file `src/route.path.ts` and imported by both `App.tsx` and `sw.ts`:

```tsx
// src/route.path.ts
export const SPA_ROUTES = ['/files', '/reader'] as const
export function isSpaRoutePath(pathname: string): boolean { ... }
```

```tsx
<BrowserRouter>
  <RedirectHandler />            ← Parses ?redirect= / ?fragment= on boot
  <Routes>
    <Route element={<AppShell />}>     ← Layout with tab bar + <Outlet />
      <Route index element={<Navigate to="/files" />} />
      <Route path="files" element={<FileExplorerPage />} />
      <Route path="reader" element={<ReaderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />  ← Catch-all
    </Route>
  </Routes>
</BrowserRouter>
```

- The **AppShell** component renders a shadcn `Tabs` bar and an `<Outlet>` for the active route
- Tab clicks navigate via `useNavigate()` — no full-page reloads
- A catch-all `<Route path="*">` redirects unmatched client-side paths to root, preventing blank pages
- The **RedirectHandler** component handles `?redirect=` and `?fragment=` query params set by the SW or `404.html`
- SW-intercepted routes use `location.replace()` to trigger full navigation when the path isn't a known SPA route

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (from root: `npm run dev`) |
| `npm run build` | Type-check + Vite build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run typecheck` | TypeScript check (no emit) |
| `npm run test` | Run Vitest (watch mode) |
| `npm run test:run` | Run Vitest once |

## Dependencies

- React 19, React DOM 19
- `@workspace/ui` (shared component library)
- `react-router` v7 (client-side routing)
- `@zenfs/core` + `@zenfs/dom` (virtual filesystem with WebAccess backend)
- `lucide-react` (icons)
- `@vitejs/plugin-react`, `@tailwindcss/vite` (build plugins)
- `vite-plugin-pwa` + Workbox (`workbox-precaching`, `workbox-core`) — PWA service worker
- `vitest` + `@testing-library/react` + `jsdom` — test infrastructure

## ZenFS Pitfalls & Solutions

### Problem 1: Sync wrappers swallow FSA errors

ZenFS's `writeFileSync`, `mkdirSync`, `unlinkSync` etc. wrap async FSA operations. When FSA rejects (e.g., "Name is not allowed" for filenames containing `:`), the sync wrapper does NOT throw — the error becomes an **unhandled promise rejection** that the calling code cannot catch.

**Rule**: Always use the `promises` API (`promises.writeFile`, `promises.mkdir`, etc.) for mutations. Sync API is safe for reads only (`readdirSync`, `statSync`, `readFileSync`).

### Problem 2: FSA forbids `:` in filenames

EPUB `uniqueIdentifier` values often contain colons (`urn:uuid:...`, `urn:isbn:...`). FSA rejects these with "Name is not allowed". Use `sanitizeFilename()` to replace forbidden characters (`: \ / ? " < > |`) with `_` for all ZenFS paths. Keep the original identifier for in-memory collection keys.

### Problem 3: writeFile does not truncate on WebAccess

ZenFS `promises.writeFile` with flag `'w'` on the WebAccess/FSA backend does not reliably truncate existing files. When writing shorter content over longer content, old data remains after the new data, producing malformed output.

**Rule**: Always `unlink` before `writeFile` when replacing a file:
```ts
try { await promises.unlink(path) } catch { /* may not exist */ }
await promises.writeFile(path, newData, "utf-8")
```

### Problem 4: Rapid mutations interleave on viewModel.json

Two rapid mutations (e.g., delete two EPUBs in quick succession) can corrupt `viewModel.json` because both write operations overlap.

**Rule**: Serialize writes via a promise chain (`_writeQueue: Promise<void>`). Each mutation chains its write onto the previous one:
```ts
const writeOp = this._writeQueue.then(async () => {
  await this.promisesFs.unlink(path).catch(() => {})
  await this.promisesFs.writeFile(path, json, "utf-8")
})
this._writeQueue = writeOp.catch(() => { /* keep queue alive */ })
return writeOp
```

### Problem 5: UI freezes after failed write

If the viewModel.json write rejects, `await` throws before `notifyUpdate()`. The in-memory collection was already mutated, but React never re-renders.

**Rule**: Wrap `_writeViewModelFile` in try/catch in every mutation method. Always call `notifyUpdate()` regardless of write success.

## Service Worker / ZenFS Architecture

The frontend and the Service Worker each have their own independent ZenFS instance with separate inode tables. This means:

1. **Frontend ZenFS** (`lib/zenfs.ts`): Configured on app start with the user's FSA mount handles. Used for reading/writing EPUB files, viewModel.json, etc.

2. **SW ZenFS** (`sw-routes/zenfs-sw.ts`): Reconfigured lazily from IndexedDB mount entries on the first intercepted `/@epubs/` request.

### The sync problem

When the frontend modifies files within an already-mounted backend (e.g., deleting+rewriting `viewModel.json`), the SW's ZenFS instance still holds the old file data in its internal inode table. The SW throws `"Unexpected mismatch in file data size"` because its cached metadata doesn't match the FSA file's actual size after modification.

### The fix

1. **Frontend notifies SW after file mutations**: Any code that writes files under a mounted backend calls `notifyServiceWorker()` (from `lib/zenfs.ts`), which posts `{ type: "zenfs-reload" }` to the SW controller.

2. **SW always reconfigures when dirty**: `ensureZenFS()` checks a `_mountsDirty` flag. When set, it ALWAYS calls `zenfsConfigure()` with fresh FSA handles — creating a new inode table — regardless of whether the mount entry list changed. The old mount-hash optimization was removed because it skipped reconfigure when only file contents changed (not mount entries).

3. **Reactivity**: `notify()` in `lib/zenfs.ts` snapshots `_snapshot.entries` as `[..._mountEntries]` (new array) to guarantee React's `useSyncExternalStore` detects changes. The file explorer also lists `zenfs.entries` in `useMemo` deps.

### The notification chain

```
ViewModel._writeViewModelFile()
  → notifyServiceWorker()          // posts message to SW
    → SW message handler           // sets _mountsDirty = true
      → next /@epubs/ request
        → ensureZenFS()            // calls zenfsConfigure() with fresh handles
```