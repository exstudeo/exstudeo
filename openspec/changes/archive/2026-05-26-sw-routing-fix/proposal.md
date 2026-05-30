## Why

The service worker's current navigation fallback blindly returns 404 for any route not in the precache — including valid SPA routes like `/files` and `/reader`. This breaks page refreshes and direct URL access: users who refresh on `/reader` see a "Not Found" page instead of the app. Additionally, there is no graceful handling for users visiting the app for the first time without the service worker installed.

## What Changes

- **Create `route.path.ts`** — a shared source-of-truth file listing all React Router SPA route prefixes (`/files`, `/reader`), imported by both `App.tsx` and `sw.ts`
- **Replace the SW's flat 404 NavigationRoute** with a three-way router:
  1. SPA routes → redirect to `/?redirect=<path>&fragment=<hash>` for the app to navigate to
  2. Known SW resource (`/validate_service_worker.html`) → serve a diagnostic page
  3. Genuinely unknown paths → serve a "SW Can't Find Page" 404 with DOMParser + `data-bind` interpolation (importing HTML via `?raw`)
- **Rewrite `public/404.html`** to capture `location.pathname + location.search + location.hash` and redirect to `/?redirect=...&fragment=...` — this handles the cold-visit (no SW) case
- **Add redirect handler in `App.tsx`** — on boot, parse `?redirect=` and `?fragment=`, match against SPA route list, and either React Router navigate() (match) or `location.replace()` (no match, let SW handle it)
- **Preserve URL fragments** — 404.html reads `location.hash` and passes it as the `fragment` query param; the app re-encodes it to URL hash on navigation

## Capabilities

### New Capabilities
- `sw-routing`: SPA-aware service worker routing with three-tier handling (redirect, diagnostic, 404) and shared route definitions

### Modified Capabilities
- `pwa-foundation`: The "Navigation fallback returns 404" and "Custom route handlers register before fallback" requirements are replaced — the flat NavigationRoute is removed in favor of the new `sw-routing` scheme

## Impact

- **`apps/web/src/route.path.ts`** — new file, defines `SPA_ROUTES` array
- **`apps/web/src/sw.ts`** — complete rewrite of route handling logic
- **`apps/web/public/404.html`** — rewritten to redirect with `redirect` + `fragment` query params
- **`apps/web/src/App.tsx`** — added `?redirect=` / `?fragment=` handling on boot
- **`apps/web/src/sw-templates/`** — new directory with `.html` files imported via `?raw` for SW-served pages
- **`openspec/specs/sw-routing/spec.md`** — new spec
- **`openspec/specs/pwa-foundation/delta.sw-routing.md`** — delta spec for modified requirements