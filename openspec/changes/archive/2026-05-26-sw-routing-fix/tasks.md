## 1. Shared route definitions

- [x] 1.1 Create `apps/web/src/route.path.ts` exporting `SPA_ROUTES` const array (`/files`, `/reader`) with `as const` assertion and TSDoc
- [x] 1.2 Update `App.tsx` to import `SPA_ROUTES` from `route.path.ts` and derive `<Route path>` props from it
- [x] 1.3 Create `apps/web/src/sw-templates/` directory structure for SW HTML templates

## 2. Static 404.html redirect

- [x] 2.1 Rewrite `public/404.html` with inline JS that reads `location.pathname + location.search + location.hash` and redirects via `window.location.replace('/?redirect=...&fragment=...')`
- [x] 2.2 Add `<noscript><meta http-equiv="refresh">` fallback (basic redirect without fragment preservation)

## 3. SW three-tier routing

- [x] 3.1 Create SW HTML templates (`sw-not-found.html`, `sw-validate.html`) with `data-bind` attribute placeholders in `src/sw-templates/`
- [x] 3.2 Import templates in `sw.ts` via `?raw` suffix and implement `renderTemplate(template: string, bindings: Record<string, string>)` utility using `DOMParser`
- [x] 3.3 Implement SPA route redirect handler — import `SPA_ROUTES`, check `pathname.startsWith(route)`, respond with 302 to `/?redirect=...&fragment=...`
- [x] 3.4 Implement validation page handler — exact match for `/validate_service_worker.html`, respond with diagnostic HTML showing request JSON
- [x] 3.5 Implement 404 catch-all — `NavigationRoute` returning rendered `sw-not-found.html` with the requested URL bound
- [x] 3.6 Register all three handlers behind the existing `manifest.length > 0` guard, in correct order: SPA redirect → validation → 404
- [x] 3.7 Remove the old flat 404 `NavigationRoute` registration

## 4. App redirect handler

- [x] 4.1 Create redirect handling logic in `App.tsx` (or `src/lib/redirect-handler.ts`) that parses `?redirect=` and `?fragment=` on boot, matches against `SPA_ROUTES`, and either `navigate()` (SPA match) or `location.replace()` (unknown path)
- [x] 4.2 Clean up URL params from address bar after handling via `history.replaceState`
- [x] 4.3 Verify the `#` fragment is properly reconstructed from the `fragment` query parameter, being careful with `:~:text=` text fragment directives

## 5. Validation and cleanup

- [x] 5.1 Run `npm run build` and verify no TypeScript or build errors
- [x] 5.2 Run `npm run preview` and test the full flow: cold visit to `/reader`, refresh with SW active, visit to unknown path, visit to `/validate_service_worker.html`