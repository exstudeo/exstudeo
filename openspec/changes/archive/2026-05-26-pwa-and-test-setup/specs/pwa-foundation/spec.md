## ADDED Requirements

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

The system SHALL generate a `manifest.json` from `vite-plugin-pwa` config. The manifest MUST include `name`, `short_name`, `description`, `start_url`, `display: 'standalone'`, `background_color`, `theme_color`, and icons arrays for 192x192 and 512x512.

#### Scenario: Manifest is available in production
- **WHEN** the production build runs
- **THEN** a `manifest.json` is emitted at the output root
- **AND** the manifest contains all required fields

### Requirement: SW source has correct TypeScript types

The service worker source file `src/sw.ts` SHALL include `/// <reference lib="webworker" />` at the top to provide `ServiceWorkerGlobalScope` types. The source SHALL be excluded from `tsconfig.app.json` via `exclude` to avoid DOM lib conflicts.

#### Scenario: TypeScript recognizes SW globals
- **WHEN** TypeScript checks `src/sw.ts`
- **THEN** `self`, `clients`, `skipWaiting`, and event types are recognized

#### Scenario: SW excluded from app tsconfig
- **WHEN** `tsc -b` runs for the app build
- **THEN** `src/sw.ts` is not type-checked against the app's `tsconfig.app.json`