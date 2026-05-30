## Context

The current service worker uses a `NavigationRoute` catch-all that returns a flat 404 for any route not in the precache. This breaks SPA navigation because routes like `/files` and `/reader` are valid React Router paths but are not precached as individual entries — only `index.html` is precached. When a user refreshes on `/files`, the SW doesn't know this is a valid SPA route and returns a "Not Found" page.

Additionally, there is no handling for cold visits (user types a URL directly without the SW installed). The static `public/404.html` just shows a generic 404 with a "Go home" link.

## Goals / Non-Goals

**Goals:**
- SPA routes are defined in one place (`route.path.ts`) and shared between app and SW
- SW redirects recognized SPA routes to `/?redirect=...&fragment=...` instead of showing 404
- Cold visits (no SW) use `public/404.html` to redirect to root with path and fragment preserved
- The app's root page reads `?redirect=` and `?fragment=`, navigates to the correct route
- Genuinely unknown paths still get a proper 404 from the SW
- SW serves a crude diagnostic page at `/validate_service_worker.html`
- All query params besides `redirect` and `fragment` pass through unchanged
- URL fragments are preserved in the cold-visit path (404.html → root → SPA route)

**Non-Goals:**
- Fragments cannot be preserved in the SW path (fundamental HTTP limitation)
- No sessionStorage-based fragment recovery — deferred to future improvement
- No complex diagnostic page — just a JSON dump of request parameters
- No changes to the existing Workbox precaching or auto-update behavior
- No changes to vite-plugin-pwa configuration

## Decisions

### Decision: Shared route definition via `route.path.ts`

A new file `apps/web/src/route.path.ts` exports `SPA_ROUTES` as a `readonly string[]`. Both `App.tsx` and `sw.ts` import it directly. This keeps routes in sync automatically and avoids duplicating path strings.

### Decision: SW uses `startsWith` matching for SPA routes

Routes are matched by prefix (`pathname.startsWith(route)`) rather than exact equality. This ensures nested paths like `/reader/some-book/chapter-3` are handled correctly now and in the future. The redirect URL encodes only the actual requested path, not the route prefix.

### Decision: SW generates HTML via `?raw` import + DOMParser + `data-bind`

HTML template files live in `src/sw-templates/` and are imported with Vite's `?raw` suffix. The SW parses the template string with `new DOMParser()`, sets `textContent` on elements matching `[data-bind="key"]`, and returns `doc.documentElement.outerHTML` as the response body. This approach:

- Avoids string interpolation risks (XSS, HTML entity issues)
- Keeps HTML in `.html` files, not inline strings
- Does NOT use `with { type: 'html' }` (confirmed incompatible with SW injectManifest pipeline)
- Leaves a comment noting `with { type: 'html' }` as a future upgrade path

### Decision: SW registers route handlers in explicit order

Using Workbox's `registerRoute`, handlers are registered in this order:

1. **SPA redirect handler** — a custom callback that checks `startsWith` against `SPA_ROUTES`
2. **Validation page handler** — exact match for `/validate_service_worker.html`
3. **404 catch-all handler** — `NavigationRoute` for unmatched navigations

Order matters because Workbox evaluates handlers in registration order.

### Decision: 404.html encodes fragment as query param

The static error page at `public/404.html`:
- Reads `location.pathname`, `location.search`, and `location.hash` from the browser
- Encodes path+search as `redirect` param and hash content (without `#`) as `fragment` param
- Calls `window.location.replace('/?' + params.toString())` — using `replace()` not `href=` to avoid polluting browser history
- Includes a `<noscript><meta http-equiv="refresh">` fallback (without fragment preservation, which requires JS)

### Decision: URL hash encoding in 404.html

The `fragment` query parameter encodes the raw fragment content without the leading `#`, URL-encoded. For example:
- URL: `/reader#section-3:~:text=hello`
- Fragment: `section-3:~:text=hello`
- Encoded: `fragment=section-3%3A~%3Atext%3Dhello`

This preserves both scroll anchors and text fragments (`:~:text=...`) transparently.

### Decision: App.tsx handles redirect on boot

A new `RedirectHandler` component (or inline logic in `App.tsx`):
1. Checks `new URLSearchParams(location.search)` for `redirect` and `fragment` params
2. If `redirect` is present:
   a. Constructs the target URL: `redirect + '#' + fragment`
   b. Checks if `redirect` path starts with any `SPA_ROUTES` entry
   c. **If match**: uses React Router `navigate()` to navigate client-side
   d. **If no match**: uses `window.location.replace()` to let the SW handle it (will get a proper 404)
3. Cleans up URL params after handling (optional, via `window.history.replaceState`)
4. Only runs once on initial mount

### Decision: SW redirect format preserves original query

The SW's redirect URL encodes the full original pathname + search query inside the `redirect` param:
```
/?redirect=%2Freader%3Ffile%3Dnietzsche.md&fragment=
```

This means `redirect` is a single opaque string — the app decodes it and reconstructs the full URL. No splitting of original params vs redirect params.

## Data Flow

```
                    route.path.ts
                         │
           ┌─────────────┼─────────────┐
           │             │             │
      App.tsx         sw.ts       404.html (static)
           │             │             │
           │             │             │ reads location
           │             │             │ path+search+hash
           │             │             │
           │        ┌────┴────┐        │
           │        │ starts- │        │
           │        │ With?   │        │
           │        └────┬────┘        │
           │        ┌────┼────┐        │
           │     YES │    │ NO │       │
           │        │    │    │        │
           │        ▼    │    ▼        │
           │    redirect │  404 page   ▼
           │    to root  │            replace to
           │    with     │            /?redirect=...
           │    params   │            &fragment=...
           │             │
           └──────┬──────┘
                  │
                  ▼
           App reads ?redirect=
           &fragment= on boot
                  │
           ┌──────┴──────┐
           │ startsWith  │
           │ SPA_ROUTES? │
           └──────┬──────┘
               YES │      NO
                   ▼      ▼
           React Router   location.replace(target)
           navigate(...)  → SW handles it → 404
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| **Fragments lost on SW path** (refresh with active SW) | Acceptable limitation — fragments are in-page anchors, not routing state. SessionStorage mitigation deferred. |
| **DOMParser not available in SW** | `DOMParser` is available in both Chrome and Firefox Service Worker scopes. Not available in some older browsers — acceptable for modern PWA. |
| **`?raw` imports fail in injectManifest pipeline** | Confirmed working. Workbox's injectManifest preserves Vite's import resolution for `?raw` imports. The SW file is built by the same Vite pipeline. |
| **Double redirect loop** | Cannot happen because: (a) 404.html redirects to root; (b) root is in precache so SW serves it directly; (c) the app's redirect handler doesn't navigate back to the same root URL with params. |
| **Text fragments not processed on client-side navigation** | When React Router `navigate('/reader#:~:text=hello')` is used, the browser may not process the text fragment directive — text fragments only work on full page loads. Acceptable: text fragments degrade gracefully and are a progressive enhancement. |

## Open Questions

- Should the `redirect` and `fragment` query params be stripped from the URL after handling? Using `history.replaceState(null, '', '/')` cleans up the address bar. This is a UX preference — recommended but not required for correctness.