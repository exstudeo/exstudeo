## MODIFIED Requirements

### Requirement: SW route handlers register before the catch-all

The SPA redirect handler and the validation route handler SHALL be registered via `registerRoute` before the 404 catch-all. Registration order determines evaluation order — specific routes precede the generic 404. The 404 catch-all uses a callback matcher (not `NavigationRoute`) to precisely control which requests are caught, exempting root path, SPA routes, the validation route, and the `/@epubs/` paths.

#### Scenario: SPA redirect registered first
- **WHEN** the service worker initializes route handlers
- **THEN** the SPA redirect handler is registered before the validation page handler
- **AND** the EPUB html route handler is registered between validation and the 404 fallback

#### Scenario: /@epubs/ paths are exempt from 404
- **WHEN** a navigation request is made to `/@epubs/book.html`
- **THEN** the 404 catch-all matcher returns `false` (the EPUB route handler handles it)
- **AND** the EPUB route handler serves the file or a 404 from ZenFS

## ADDED Requirements

### Requirement: Pluggable route strategy interface

The service worker SHALL define a reusable strategy pattern in `src/sw-routes/index.ts`. The `SwRouteStrategy` interface SHALL have a `name` (string for logging), a `match` callback (`RouteMatchCallback` from workbox-routing), and a `handler` (`RouteHandler`). A `registerStrategies()` function SHALL accept an array of `SwRouteStrategy` and call `registerRoute()` for each in order.

#### Scenario: Strategies are registered in order
- **WHEN** `registerStrategies([spa, validate, epub, notFound])` is called
- **THEN** `registerRoute` is called 4 times in that sequence

### Requirement: PostMessage protocol for ZenFS mount sync

The service worker SHALL listen for `message` events of type `"zenfs-reload"`. On receiving this message, the SW SHALL set an internal `_mountsDirty` flag to `true`. On the next intercepted request to `/@epubs/`, the SW SHALL re-read mount entries from IndexedDB and reconfigure its ZenFS instance if the mount list has changed, then clear the dirty flag.

#### Scenario: zenfs-reload triggers lazy refresh
- **WHEN** the SW receives a `message` event with `data.type === "zenfs-reload"`
- **THEN** `_mountsDirty` is set to `true`
- **AND** the SW's ZenFS instance is NOT reconfigured immediately
- **AND** on the next `/@epubs/` request, the SW re-reads mount entries from IndexedDB and reconfigures if needed
