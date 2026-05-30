# PWA Foundation

## Purpose

The PWA foundation provides the service worker infrastructure and manifest needed for offline-capable reading. All app shell assets are precached at install time, and the service worker auto-updates on new deployments without user interaction.

## Requirements

### Requirement: App shell is available offline

The system SHALL precache the complete app shell (index.html, all JS bundles, all CSS bundles) when the service worker installs. The app shell MUST be served from cache when the network is unavailable. The service worker SHALL use `workbox-precaching` with the auto-generated manifest (`self.__WB_MANIFEST`).

#### Scenario: App shell cached on first install
- **WHEN** the service worker installs
- **THEN** all entries in `self.__WB_MANIFEST` are added to the precache

#### Scenario: App loads offline after install
- **WHEN** a page load occurs while offline
- **AND** the service worker has previously installed
- **THEN** the app shell is served from the precache

#### Scenario: App shell updates on new build
- **WHEN** a new build produces different asset hashes
- **THEN** the updated entries are added to the precache on the next SW install

### Requirement: Service worker auto-updates

The service worker SHALL auto-activate when a new version is detected. It MUST call `self.skipWaiting()` on install and `clients.claim()` on activate. No user prompts or "Update available" toasts SHALL be shown.

#### Scenario: New SW takes control immediately
- **WHEN** a new service worker is detected and installed
- **THEN** `skipWaiting()` is called immediately
- **AND** the new SW activates without waiting for page refresh

#### Scenario: New SW controls all clients
- **WHEN** the new SW activates
- **THEN** `clients.claim()` is called
- **AND** all open tabs are controlled by the new SW

### Requirement: Service worker is active in development

The system SHALL activate the service worker during `npm run dev` via `vite-plugin-pwa`'s `devOptions.enabled: true` and `devOptions.type: 'module'`. Changes to `sw.ts` SHALL trigger SW recompilation and re-registration.

#### Scenario: SW registers in dev mode
- **WHEN** `npm run dev` starts
- **AND** the browser loads the app
- **THEN** the service worker registers from `/dev-sw.js`

#### Scenario: SW source change triggers rebuild
- **WHEN** `src/sw.ts` is modified during dev
- **THEN** Vite recompiles the SW
- **AND** the dev SW is re-registered on the next page load

### Requirement: PWA manifest is generated

The system SHALL generate a `manifest.webmanifest` from `vite-plugin-pwa` config. The manifest MUST include `name`, `short_name`, `description`, `start_url`, `display: 'standalone'`, `background_color`, `theme_color`, and icons arrays for 192x192 and 512x512. The manifest link SHALL be auto-injected by the plugin — no manual `<link>` tag is needed.

#### Scenario: Manifest is available in production
- **WHEN** the production build runs
- **THEN** a `manifest.webmanifest` is emitted at the output root
- **AND** the manifest contains all required fields

### Requirement: SW source has correct TypeScript types

The service worker source file `src/sw.ts` SHALL include `/// <reference lib="webworker" />` at the top to provide `ServiceWorkerGlobalScope` types. The source SHALL be excluded from `tsconfig.app.json` via `exclude` to avoid DOM lib conflicts.

#### Scenario: TypeScript recognizes SW globals
- **WHEN** TypeScript checks `src/sw.ts`
- **THEN** `self`, `clients`, `skipWaiting`, and event types are recognized

#### Scenario: SW excluded from app tsconfig
- **WHEN** `tsc -b` runs for the app build
- **THEN** `src/sw.ts` is not type-checked against the app's `tsconfig.app.json`

### Requirement: Navigation fallback returns 404

*Replaced. The three-tier routing scheme is defined in `specs/sw-routing/spec.md`. This requirement is retained for the dev-mode manifest guard.*

The service worker SHALL register route handlers after the existing `manifest.length > 0` guard: a SPA redirect handler for known routes (from `route.path.ts`), a diagnostic handler for `/validate_service_worker.html`, and a 404 catch-all for everything else. The old `NavigationRoute`-based flat 404 is replaced by a callback matcher that precisely controls which requests are caught (exempts root path, SPA routes, and the validation route).

#### Scenario: All route handlers guard behind non-empty manifest
- **WHEN** the service worker initializes
- **AND** the manifest is non-empty
- **THEN** the SPA redirect, validation, and 404 handlers are registered
- **AND** the previous `NavigationRoute` fallback is NOT registered

### Requirement: Custom route handlers register before fallback

*Updated. Registration order is: SPA redirect → validation handler → 404 catch-all.*

Custom service worker route handlers SHALL be registered in explicit order. Workbox evaluates handlers in registration order, so the specific handlers (SPA redirect, validation page) MUST precede the catch-all 404.

#### Scenario: Three handlers in proper order
- **WHEN** custom route handlers are registered
- **THEN** the SPA redirect handler is first in registration order
- **AND** the validation page handler is second
- **AND** the 404 catch-all is last

### Requirement: Dev mode manifest guard

In development mode, `self.__WB_MANIFEST` is empty. The service worker SHALL guard precaching and custom route handler registration behind a check that the manifest is non-empty, so the dev server handles all requests without SW interference.

#### Scenario: Dev mode skips precaching
- **WHEN** the service worker registers in dev mode
- **AND** `self.__WB_MANIFEST` is empty
- **THEN** `precacheAndRoute()` is not called
- **AND** the SPA redirect, validation, and 404 handlers are not registered
- **AND** the dev server handles all requests normally