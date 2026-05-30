# SW Routing

## Purpose

The service worker uses a shared route definition file to distinguish valid SPA routes from unknown paths. Instead of a flat 404 NavigationRoute, the SW applies a three-tier strategy: redirect SPA routes to the app's root with a redirect parameter, serve a diagnostic page for a known validation endpoint, and return a styled 404 for everything else.

## Requirements

### Requirement: SPA routes are defined in a shared file

The SPA route prefixes SHALL be defined in a single file `src/route.path.ts` readable by both the React app and the service worker. The file SHALL export a const array `SPA_ROUTES` containing route prefix strings (e.g., `/files`, `/reader`) and a helper function `isSpaRoutePath()` that checks pathnames using path-segment matching. This prevents `/filesxx` from falsely matching `/files` while still allowing nested routes like `/reader/some-book`.

#### Scenario: route.path.ts exports known routes
- **WHEN** `src/route.path.ts` is imported
- **THEN** the `SPA_ROUTES` export contains at least `/files` and `/reader`
- **AND** each entry is a string without trailing slash

#### Scenario: route.path.ts is imported by App.tsx
- **WHEN** `App.tsx` configures React Router `<Routes>`
- **THEN** the route `path` props are derived from `SPA_ROUTES`
- **AND** the routes are kept in sync with the shared definition

#### Scenario: route.path.ts is imported by sw.ts
- **WHEN** the service worker compiles
- **THEN** it has access to the exact same `SPA_ROUTES` array as the app

#### Scenario: isSpaRoutePath rejects lookalike paths
- **WHEN** `isSpaRoutePath("/filesxx")` is called
- **THEN** it returns `false` (path does not equal `/files` or start with `/files/`)
- **AND** `isSpaRoutePath("/reader/some-book")` returns `true`

### Requirement: SW redirects SPA routes to root with redirect param

When the service worker intercepts a navigation request whose pathname matches a known SPA route via `isSpaRoutePath()`, it SHALL respond with a 302 redirect to `/?redirect=<encoded-path>&fragment=<encoded-hash>`. The redirect target SHALL encode the full original pathname and search query. Fragments cannot be seen by the SW — the `fragment` parameter SHALL be set to an empty string when no fragment was in the request.

#### Scenario: SW redirects /files to root
- **WHEN** the service worker receives a navigation to `/files`
- **THEN** it responds with a redirect to `/?redirect=%2Ffiles&fragment=`
- **AND** the status code is 302

#### Scenario: SW redirects /reader?file=x.md to root
- **WHEN** the service worker receives a navigation to `/reader?file=x.md`
- **THEN** it responds with a redirect to `/?redirect=%2Freader%3Ffile%3Dx.md&fragment=`

#### Scenario: SW handles nested SPA routes
- **WHEN** the service worker receives a navigation to `/reader/some/book`
- **AND** `/reader/some/book` starts with `/reader/`
- **THEN** it responds with a redirect to `/?redirect=%2Freader%2Fsome%2Fbook&fragment=`

### Requirement: SW serves a diagnostic page for a known validation route

The service worker SHALL intercept navigations to `/validate_service_worker.html` and respond with an inline HTML page that displays a JSON dump of the intercepted request's parameters (URL, method, headers subset). This page SHALL be generated using string template interpolation (`{{key}}` placeholders) on an HTML template imported via `?raw`.

#### Scenario: Diagnostic page shows request info
- **WHEN** the service worker receives a navigation to `/validate_service_worker.html`
- **THEN** it responds with status 200
- **AND** the response body contains a JSON representation of the request URL
- **AND** the Content-Type is `text/html;charset=utf-8`

### Requirement: SW returns styled 404 for unknown routes

When the service worker intercepts a navigation whose pathname does NOT match via `isSpaRoutePath()` and is NOT `/validate_service_worker.html`, it SHALL respond with status 404 and a minimal HTML page titled "Service Worker Can't Find the Page". The HTML SHALL be generated from a `?raw`-imported template using string `{{key}}` placeholder interpolation.

#### Scenario: Unknown path returns SW 404
- **WHEN** the service worker receives a navigation to `/garbage`
- **THEN** it responds with status 404
- **AND** the response body contains a page that includes the requested URL

### Requirement: SW route handlers register before the catch-all

The SPA redirect handler and the validation route handler SHALL be registered via `registerRoute` before the 404 catch-all. Registration order determines evaluation order — specific routes precede the generic 404. The 404 catch-all uses a callback matcher (not `NavigationRoute`) to precisely control which requests are caught, exempting root path, SPA routes, the validation route, and the `/@epubs/` paths.

#### Scenario: SPA redirect registered first
- **WHEN** the service worker initializes route handlers
- **THEN** the SPA redirect handler is registered before the validation page handler
- **AND** the EPUB resources route handler is registered between validation and the 404 fallback

#### Scenario: /@epubs/ paths are exempt from 404
- **WHEN** a navigation request is made to `/@epubs/book.html`
- **THEN** the 404 catch-all matcher returns `false` (the EPUB route handler handles it)
- **AND** the EPUB route handler serves the file or a 404 from ZenFS

### Requirement: HTML templates use string interpolation

HTML template files SHALL be stored in `src/sw-templates/` and imported via Vite's `?raw` suffix. The service worker SHALL render templates by replacing `{{key}}` placeholders with bound values using simple string replacement. This is chosen over `DOMParser` because `DOMParser` is not reliably available in all Service Worker environments. A comment shall note that this can be upgraded to `with { type: 'html' }` when Vite supports it.

#### Scenario: String interpolation replaces placeholders
- **WHEN** the SW renders a template with `<code>{{url}}</code>`
- **AND** the binding value is `"/test-path"`
- **THEN** the output HTML contains `<code>/test-path</code>`

### Requirement: Templates are excluded from the dev manifest guard

All SW routing logic (SPA redirect, validation page, 404) SHALL be gated behind the existing `manifest.length > 0` check, so in dev mode (empty manifest) the dev server handles all requests without SW interference.

#### Scenario: Dev mode bypasses SW routing
- **WHEN** the service worker is in dev mode (empty manifest)
- **THEN** no custom route handlers are registered
- **AND** all navigation requests go to the dev server

### Requirement: Pluggable route strategy interface

The service worker SHALL define a reusable strategy pattern in `src/sw-routes/index.ts`. The `SwRouteStrategy` interface SHALL have a `name` (string for logging), a `match` callback (`RouteMatchCallback` from workbox-routing), and a `handler` (`RouteHandler`). A `registerStrategies()` function SHALL accept an array of `SwRouteStrategy` and call `registerRoute()` for each in order.

#### Scenario: Strategies are registered in order
- **WHEN** `registerStrategies([spa, validate, epub, notFound])` is called
- **THEN** `registerRoute` is called 4 times in that sequence

### Requirement: PostMessage protocol for ZenFS mount sync

The service worker SHALL listen for `message` events of type `"zenfs-reload"`. On receiving this message, the SW SHALL set an internal `_mountsDirty` flag to `true`. On the next intercepted request to `/@epubs/`, the SW SHALL ALWAYS reconfigure its ZenFS instance by calling `zenfsConfigure()` with fresh FSA handles from IndexedDB, regardless of whether the mount entry list changed. This is necessary because the frontend may have modified file contents within an already-mounted backend (e.g., deleting+rewriting `viewModel.json`), and the SW's ZenFS instance holds a separate inode table that becomes stale without a full reconfigure.

#### Scenario: zenfs-reload triggers lazy refresh
- **WHEN** the SW receives a `message` event with `data.type === "zenfs-reload"`
- **THEN** `_mountsDirty` is set to `true`
- **AND** the SW's ZenFS instance is NOT reconfigured immediately
- **AND** on the next `/@epubs/` request, `ensureZenFS()` always calls `zenfsConfigure()` with fresh FSA handles (no mount-hash skip optimization)