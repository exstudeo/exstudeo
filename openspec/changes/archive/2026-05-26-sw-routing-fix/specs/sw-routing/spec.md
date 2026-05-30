# SW Routing

## Purpose

The service worker uses a shared route definition file to distinguish valid SPA routes from unknown paths. Instead of a flat 404 NavigationRoute, the SW applies a three-tier strategy: redirect SPA routes to the app's root with a redirect parameter, serve a diagnostic page for a known validation endpoint, and return a styled 404 for everything else.

## Requirements

### Requirement: SPA routes are defined in a shared file

The SPA route prefixes SHALL be defined in a single file `src/route.path.ts` readable by both the React app and the service worker. The file SHALL export a const array `SPA_ROUTES` containing route prefix strings (e.g., `/files`, `/reader`). The array MUST allow for future nested routes — matches use `startsWith` semantics, not exact equality.

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

### Requirement: SW redirects SPA routes to root with redirect param

When the service worker intercepts a navigation request whose pathname starts with any entry in `SPA_ROUTES`, it SHALL respond with a 302 redirect to `/?redirect=<encoded-path>&fragment=<encoded-hash>`. The redirect target SHALL encode the full original pathname and search query. Fragments cannot be seen by the SW — the `fragment` parameter SHALL be set to an empty string when no fragment was in the request.

#### Scenario: SW redirects /files to root
- **WHEN** the service worker receives a navigation to `/files`
- **THEN** it responds with a redirect to `/?redirect=%2Ffiles&fragment=`
- **AND** the status code is 302

#### Scenario: SW redirects /reader?file=x.md to root
- **WHEN** the service worker receives a navigation to `/reader?file=x.md`
- **THEN** it responds with a redirect to `/?redirect=%2Freader%3Ffile%3Dx.md&fragment=`

#### Scenario: SW handles nested SPA routes
- **WHEN** the service worker receives a navigation to `/reader/some/book`
- **AND** `/reader` starts with a known SPA route prefix
- **THEN** it responds with a redirect to `/?redirect=%2Freader%2Fsome%2Fbook&fragment=`

### Requirement: SW serves a diagnostic page for a known validation route

The service worker SHALL intercept navigations to `/validate_service_worker.html` and respond with an inline HTML page that displays a JSON dump of the intercepted request's parameters (URL, method, headers subset). This page SHALL be generated using DOMParser and `data-bind` attribute interpolation on an HTML template imported via `?raw`.

#### Scenario: Diagnostic page shows request info
- **WHEN** the service worker receives a navigation to `/validate_service_worker.html`
- **THEN** it responds with status 200
- **AND** the response body contains a JSON representation of the request URL
- **AND** the Content-Type is `text/html;charset=utf-8`

### Requirement: SW returns styled 404 for unknown routes

When the service worker intercepts a navigation whose pathname does NOT start with any `SPA_ROUTES` entry and is NOT `/validate_service_worker.html`, it SHALL respond with status 404 and a minimal HTML page titled "Service Worker Can't Find the Page". The HTML SHALL be generated from a `?raw`-imported template using DOMParser with `data-bind` attribute interpolation.

#### Scenario: Unknown path returns SW 404
- **WHEN** the service worker receives a navigation to `/garbage`
- **THEN** it responds with status 404
- **AND** the response body contains a page that includes the requested URL

### Requirement: SW route handlers register before the catch-all

The SPA redirect handler and the validation route handler SHALL be registered via `registerRoute` before any catch-all fallback. Registration order determines evaluation order — specific routes precede the generic 404.

#### Scenario: SPA redirect registered first
- **WHEN** the service worker initializes route handlers
- **THEN** the SPA redirect handler is registered before the 404 fallback
- **AND** the validation route handler is registered between them

### Requirement: HTML templates use DOMParser + data-bind interpolation

HTML template files SHALL be stored in `src/sw-templates/` and imported via Vite's `?raw` suffix. The service worker SHALL parse the string into a DOM document using `DOMParser`, locate elements with `data-bind="<key>"` attributes, and set their `textContent` to the corresponding value. A comment shall note that this can be upgraded to `with { type: 'html' }` when Vite supports it.

#### Scenario: DOMParser interpolates data-bind attributes
- **WHEN** the SW renders a template with `<span data-bind="url"></span>`
- **AND** the binding value is `"/test-path"`
- **THEN** the output HTML contains `<span>/test-path</span>`

### Requirement: Templates are excluded from the dev manifest guard

All SW routing logic (SPA redirect, validation page, 404) SHALL be gated behind the existing `manifest.length > 0` check, so in dev mode (empty manifest) the dev server handles all requests without SW interference.

#### Scenario: Dev mode bypasses SW routing
- **WHEN** the service worker is in dev mode (empty manifest)
- **THEN** no custom route handlers are registered
- **AND** all navigation requests go to the dev server