## 1. PWA Dependencies & Config

- [x] 1.1 Add `vite-plugin-pwa` as devDependency in `apps/web/package.json`
- [x] 1.2 Add `workbox-precaching` and `workbox-core` as devDependencies in `apps/web/package.json`
- [x] 1.3 Add `VitePWA` plugin to `apps/web/vite.config.ts` with `injectManifest` mode, `src/sw.ts` entry, dev options (`enabled: true`, `type: 'module'`), auto-update registration, and manifest config (name, short_name, display: standalone, theme_color, background_color, placeholder icons 192x192 + 512x512)

## 2. Service Worker Source

- [x] 2.1 Create `apps/web/src/sw.ts` with `/// <reference lib="webworker" />` header, `precacheAndRoute(self.__WB_MANIFEST)`, `skipWaiting()` on install, and `clients.claim()` on activate
- [x] 2.2 Update `apps/web/tsconfig.app.json` to exclude `src/sw.ts` from the app build

## 3. PWA Placeholder Icons & HTML

- [x] 3.1 Create placeholder SVG icons at `apps/web/public/pwa-192x192.png` and `apps/web/public/pwa-512x512.png` (or generate minimal PNG placeholders)
- [x] 3.2 Add `<link rel="manifest" href="/manifest.json" />` and PWA meta tags to `apps/web/index.html`

## 4. Test Dependencies & Config

- [x] 4.1 Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, and `jsdom` as devDependencies in `apps/web/package.json`
- [x] 4.2 Create `apps/web/vitest.config.ts` with `react()` and `tailwindcss()` plugins, `jsdom` environment, `src/test/setup.ts` as setup file, and test file pattern `src/**/*.{test,spec}.{ts,tsx}`
- [x] 4.3 Add `"test": "vitest"` and `"test:run": "vitest run"` scripts to `apps/web/package.json`
- [x] 4.4 Create `apps/web/src/test/setup.ts` importing `@testing-library/jest-dom`

## 5. Verify

- [x] 5.1 Run `npm run build` from monorepo root to verify PWA build (SW compiled, manifest generated, precache manifest injected)
- [x] 5.2 Run `cd apps/web && npm run test:run` to verify Vitest discovers and runs tests (zero-test pass, no errors)
- [x] 5.3 Run `cd apps/web && npx tsc --noEmit -p tsconfig.app.json` to verify SW exclusion works (no DOM lib conflicts)