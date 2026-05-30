## Why

Exstudeo is envisioned as a Progressive Web App for offline reading, but currently has no PWA manifest, service worker, or test infrastructure. Without these foundations, the project cannot deliver offline capability and lacks the quality guardrails needed for reliable development. Setting up PWA support and testing now establishes the architecture before feature work begins.

## What Changes

- Add `vite-plugin-pwa` with `injectManifest` mode for service worker authoring
- Create a service worker source (`src/sw.ts`) that precaches the app shell and auto-updates
- Add Workbox libraries for SW development (`workbox-precaching`, `workbox-core`)
- Configure `vite-plugin-pwa` for dev-mode SW availability and production builds
- Add `vitest` as test runner with separate `vitest.config.ts`
- Add `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, and `jsdom` for component testing
- Create test setup file with jest-dom matchers
- Adopt co-located test convention (`Component.test.tsx` next to source)
- Add `test` and `test:run` scripts to `apps/web/package.json`
- Update `tsconfig.app.json` to exclude `src/sw.ts` from the app build
- Placeholder PWA icons for manifest

## Capabilities

### New Capabilities

- `pwa-foundation`: Offline-capable app shell via service worker with automatic precaching, auto-update, and dev-mode registration. Covers manifest generation, SW injectManifest configuration, and the SW lifecycle (install, activate, skipWaiting, clientsClaim).
- `test-infrastructure`: Unit and component test setup using Vitest with React Testing Library. Covers co-located test files, jest-dom matchers, jsdom environment, and shared test config.

### Modified Capabilities

*None — no existing specs to modify.*

## Impact

- **`apps/web/package.json`**: Adds `vite-plugin-pwa`, Workbox packages, Vitest, and Testing Library as devDependencies; adds `test` and `test:run` scripts
- **`apps/web/vite.config.ts`**: Adds `VitePWA()` plugin with injectManifest config
- **`apps/web/vitest.config.ts`**: New file — separate Vitest configuration
- **`apps/web/src/sw.ts`**: New file — service worker source
- **`apps/web/src/test/setup.ts`**: New file — test environment setup
- **`apps/web/tsconfig.app.json`**: Excludes `src/sw.ts` from app type-checking
- **`apps/web/public/`**: Placeholder PWA icons (192x192, 512x512)