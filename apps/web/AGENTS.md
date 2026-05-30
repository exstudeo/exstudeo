# Web App — Agent Instructions

## Purpose

This is the main PWA frontend for Exstudeo. It renders the reader interface for notes and books.

## Architecture

See [readme.md](./readme.md)

## Key Configuration

- **Build tool**: Vite 7 (`vite.config.ts`)
- **CSS**: Tailwind CSS 4 via `@tailwindcss/vite` plugin
- **PWA**: `vite-plugin-pwa` with injectManifest (`src/sw.ts`)
- **Tests**: Vitest (`vitest.config.ts`, separate from Vite config)
- **Path alias**: `@/` → `src/`
- **UI components**: Imported from `@workspace/ui/components/*`

## Agent Rules

1. Components that could be shared → move to `packages/ui/src/components/`
2. App-specific layout/routing logic stays in `src/components/`
3. Always import UI via `@workspace/ui/components/*`, never duplicate
4. Service worker source is at `src/sw.ts` — edits require rebuild (or dev-mode re-registration)
5. Custom SW route handlers (e.g., `@/*` intercept) must be registered **before** the `NavigationRoute` fallback — Workbox evaluates routes in registration order
6. The SW only activates in production; dev mode skips via empty manifest guard
7. Use `@/` path alias for intra-app imports, `@workspace/ui/*` for shared package
8. Co-locate tests: `src/foo.ts` → `src/foo.test.ts`
9. ZenFS singleton (`lib/zenfs.ts`) uses a promise lock to prevent concurrent configuration in StrictMode
10. Mount entries are persisted in IndexedDB (`lib/mount-store.ts`) — handles are structured-clonable
11. **Use Debug Build** Use `npm run build:debug` to obtain a debug build with proper source map and without minimization
12. **ZenFS/FSA critical rules** — see `readme.md` sections "ZenFS Pitfalls & Solutions" and "Service Worker / ZenFS Architecture"
    - Never use sync `fs.*Sync` for mutations — errors become unhandled promise rejections
    - Always use `promises` API for writes + `sanitizeFilename()` for paths
    - `writeFile` does NOT truncate on WebAccess backend — always `unlink` before `write`
    - Notify SW after file mutations via `notifyServiceWorker()`
    - Snapshot arrays in `notify()` to guarantee React reactivity 