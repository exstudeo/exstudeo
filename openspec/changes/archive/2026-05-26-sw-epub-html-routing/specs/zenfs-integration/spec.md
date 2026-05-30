## ADDED Requirements

### Requirement: Frontend notifies service worker of mount changes

The frontend ZenFS singleton (`lib/zenfs.ts`) SHALL export a function `notifyServiceWorker()` that posts a message `{ type: "zenfs-reload" }` to the active service worker via `navigator.serviceWorker.controller`. This function SHALL be called after every mount and unmount operation (`mountBackend()` and `unmountBackend()`). It SHALL silently handle the case where no service worker is active.

#### Scenario: Post message after mount
- **WHEN** `mountBackend()` completes successfully
- **THEN** `notifyServiceWorker()` is called
- **AND** it posts `{ type: "zenfs-reload" }` to the service worker controller

#### Scenario: Post message after unmount
- **WHEN** `unmountBackend()` completes successfully
- **THEN** `notifyServiceWorker()` is called
- **AND** it posts `{ type: "zenfs-reload" }` to the service worker controller

#### Scenario: Handles missing service worker gracefully
- **WHEN** `notifyServiceWorker()` is called but `navigator.serviceWorker.controller` is `null`
- **THEN** the function completes without throwing
