# Used Documentation

Reference fragments and links collected during development. Libraries or tools that cleanly replace custom boilerplate are noted here for future use.

## Current References

### shadcn/ui

- **Docs**: https://ui.shadcn.com/docs
- **CLI info**: `npm exec shadcn@latest info --json` shows installed components
- **Component docs**: `npm exec shadcn@latest docs <component>`
- **Search registries**: `npm exec shadcn@latest search`
- **Local skill**: `.agents/skills/shadcn/SKILL.md` — full agent instructions for component management

### Turborepo

- **Repo**: https://github.com/vercel/turborepo
- **Docs**: https://turbo.build/repo/docs

### Vite

- **Docs**: https://vite.dev/config/
- **PWA plugin**: https://vite-pwa-org.netlify.app/ — `vite-plugin-pwa` v1.3.0 used for PWA manifest generation + service worker integration
- **injectManifest strategy**: https://vite-pwa-org.netlify.app/guide/inject-manifest.html — full control over SW source, compiles `src/sw.ts` via Vite

### Workbox

- **Docs**: https://developer.chrome.com/docs/workbox
- **workbox-precaching**: https://developer.chrome.com/docs/workbox/modules/workbox-precaching — used for app shell precaching via `precacheAndRoute(self.__WB_MANIFEST)`
- **workbox-core**: https://developer.chrome.com/docs/workbox/modules/workbox-core — provides `skipWaiting()` and `clientsClaim()`
- **workbox-routing / workbox-strategies**: available for future runtime caching (reader content, API calls)

### Vitest

- **Docs**: https://vitest.dev/ — v4.1.7 used as test runner
- **Config**: separate `vitest.config.ts` (not inline in `vite.config.ts`) to avoid VitePWA plugin interference in tests
- **Environment**: jsdom via `jsdom` package

### React Testing Library

- **Docs**: https://testing-library.com/docs/react-testing-library/intro
- **@testing-library/react**: v16.3.2 — render React components in tests
- **@testing-library/jest-dom**: v6.9.1 — DOM matchers (`toBeInTheDocument()`, etc.), loaded via `@testing-library/jest-dom/vitest` entry point
- **@testing-library/user-event**: v14.6.1 — simulate clicks, keyboard input

### OpenSpec

- **Local skills**: `.github/skills/openspec-*/` — workflow instructions for propose/apply/verify/archive

### Tailwind CSS 4

- **Docs**: https://tailwindcss.com/docs
- **Vite plugin**: `@tailwindcss/vite`

### Fontsource

- **Inter variable**: `@fontsource-variable/inter` — loaded in `globals.css`

## Adding References

When a library is recommended or used, add a brief entry here with relevant links.

### ZenFS (`@zenfs/core` + `@zenfs/dom`)

- **Main site**: https://zenfs.dev/core/
- **Source**: https://github.com/zen-fs/core
- **Promises API**: https://zenfs.dev/core/modules/index.fs.promises.html
- **`writeFile` doc**: https://zenfs.dev/core/functions/index.fs.writeFile.html — flag defaults to `'w'`, but truncation is unreliable on WebAccess/FSA backend
- **Mounting**: https://zenfs.dev/core/functions/index.fs.mount.html

### FSA (File System Access API)

- **MDN**: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
- **`showDirectoryPicker`**: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
- **`FileSystemDirectoryHandle`**: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle
- **Permission model**: Handles lose permission grants after browser restart. Must call `requestPermission({ mode: "readwrite" })` before mounting.
- **Filenames**: Forbidden characters include `:`, `\`, `/`, `?`, `"`, `<`, `>`, `|`. The FSA throws "Name is not allowed" — but ZenFS sync wrappers convert this into unhandled promise rejections, not thrown exceptions.

### Key Learnings (discovered during development)

| Problem | Root Cause | Solution |
|---------|-----------|----------|
| Sync API silent failures | `writeFileSync` wraps async FSA — errors become unhandled rejections | Use `promises.*` for all mutations |
| FSA rejects `:` | EPUB URN identifiers (`urn:uuid:...`) contain colons | `sanitizeFilename()` replaces `: \ / ? " < > |` with `_` |
| writeFile doesn't truncate | WebAccess backend doesn't clear on `flag='w'` | `unlink` before `writeFile` |
| viewModel.json corruption | Two rapid mutations interleave writes | Serialize via `_writeQueue: Promise<void>` |
| UI freezes after write failure | `await` throws before `notifyUpdate()` | Wrap write in try/catch, always call `notifyUpdate()` |
| SW serves stale file data | SW's ZenFS has separate inode table | `notifyServiceWorker()` + SW always reconfigures when dirty |
| React not re-rendering after mount | `_snapshot.entries` shared same array ref | Spread `[..._mountEntries]` in `notify()` |

### SW / Frontend Dual-ZenFS Architecture

The frontend and the Service Worker each run their own ZenFS instance. The frontend mounts via `lib/zenfs.ts` using FSA handles; the SW lazily remounts from IndexedDB in `sw-routes/zenfs-sw.ts`. File mutations by the frontend do not automatically propagate to the SW's ZenFS instance.

**Sync protocol**:
1. After any file mutation under a mounted backend, the frontend calls `notifyServiceWorker()`
2. This posts `{ type: "zenfs-reload" }` to the SW controller
3. The SW sets `_mountsDirty = true`
4. On the next `/@epubs/` request, `ensureZenFS()` always reconfigures (calls `zenfsConfigure()` with fresh handles), creating a new inode table
5. The old mount-hash optimization was removed — it incorrectly skipped reconfigure when only file contents changed