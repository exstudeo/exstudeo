## Context

Exstudeo is a Vite 7 + React 19 PWA with zero PWA infrastructure today. The app shell (index.html, JS/CSS bundles) must be offline-available. A service worker must precache build assets, auto-update on new deployments, and be active during development. No runtime caching is needed yet — that will come with future features (reader content, API calls).

Testing infrastructure is also absent. No test runner, no testing library, no setup. The project needs a foundation for co-located unit and component tests.

The project uses npm workspaces with Turborepo. All PWA and test changes are scoped to `apps/web`.

## Goals / Non-Goals

**Goals:**
- Service worker precaches app shell (index.html, JS, CSS) and makes it available offline
- Service worker auto-updates (skipWaiting + clientsClaim) on new deployment — no user prompts
- Service worker is active during `npm run dev` for development
- PWA manifest generated from build config with placeholder icons
- Vitest configured with separate `vitest.config.ts` (avoids VitePWA plugin conflicts)
- React Testing Library + jest-dom + user-event available for component tests
- Co-located test convention (`Component.test.tsx` next to source)
- `sw.ts` excluded from app TypeScript config (separate build target via VitePWA)

**Non-Goals:**
- No runtime caching strategies (NetworkFirst, CacheFirst, etc.) — content caching is future work
- No navigation route fallback — SPA routing is future work (React Router)
- No e2e tests — only unit and component tests
- No test coverage for the service worker itself (Workbox is trusted)
- No PWA icons beyond placeholders — real icons are a separate task

## Decisions

### injectManifest over generateSW

`injectManifest` gives full control over the service worker source. The SW is a TypeScript file in the project (`src/sw.ts`), compiled by Vite via `vite-plugin-pwa`. This allows:
- Shared types between SW and app (future)
- Custom install/activate logic (skipWaiting, clientsClaim)
- Easy transition to runtime caching when content features arrive
- No abstraction layer — what you write is what runs

**Alternatives considered:**
- *generateSW*: Simpler config but less control. Would need to switch later when runtime caching is added. Avoiding migration cost.
- *No PWA plugin, manual SW*: Loses manifest generation, dev-mode integration, and precache manifest injection.

### Inject `/// <reference lib="webworker" />` in sw.ts

The service worker runs in a different global scope (`ServiceWorkerGlobalScope`) than the main app. Without this reference, TypeScript would not recognize `self`, `clients`, `skipWaiting`, `install` event, etc. Adding the triple-slash directive at the top of `sw.ts` provides correct typings.

### Separate `vitest.config.ts` over inline config

`vite-plugin-pwa` would activate during test runs if placed in `vite.config.ts`, potentially causing unnecessary SW builds. A separate `vitest.config.ts` shares the same `react()` and `tailwindcss()` plugins but omits `VitePWA()`. It also allows vitest-specific configuration (`environment`, `setupFiles`, `include`) without cluttering the build config.

**Alternatives considered:**
- *Inline in vite.config.ts*: Simpler but risk of VitePWA interference. Also requires conditional logic (`process.env.VITEST`).
- *Separate tsconfig for tests*: Unnecessary complexity for unit tests.

### Co-located tests over centralized `__tests__/`

Colocation keeps tests next to their source files, making it obvious what's tested and encouraging test-writing. The glob pattern `src/**/*.{test,spec}.{ts,tsx}` in vitest config handles discovery.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Dev SW cache grows unbounded (HMR chunks) | VitePWA dev mode auto-clears SW caches on page reload via `devOptions.suppressWarnings`. Acceptable for dev. |
| `workbox-precaching` not found in SW build | Listed as devDependency — VitePWA compiles SW as separate entry, bundles Workbox into `sw.js`. Verify at build. |
| `verbatimModuleSyntax` conflicts with `import type` in tests | Test files follow strict module syntax (explicit `import type`). Vitest handles ESM natively. |
| SW update causes mid-session reload | Auto-update reloads the page. Acceptable — content is local (IndexedDB) in future, no data loss. |
| `@testing-library/react` v16 compat with React 19 | Confirmed compatible. `@testing-library/user-event` v14 also compatible. |

## Open Questions

- PWA manifest icons: Will use minimal SVG-based placeholders (192x192, 512x512). Need real icons designed later.
- SW scope: Default scope (`/`) is correct for an SPA — no changes needed.