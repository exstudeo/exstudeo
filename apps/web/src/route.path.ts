/**
 * SPA route prefixes recognized by both the React app and the service worker.
 *
 * Routes use prefix matching but ensure path-segment boundaries so that
 * `/filesxx` does NOT match `/files`. Nested paths like `/reader/some-book`
 * DO match `/reader`.
 *
 * When adding a new route, add it here and then add a corresponding
 * `<Route>` in `App.tsx` with `path={route.slice(1)}`.
 */
export const SPA_ROUTES = ['/files', '/epub', '/settings'] as const

/** Type of a single SPA route string */
export type SPA_ROUTE = (typeof SPA_ROUTES)[number]

/**
 * Checks whether `pathname` matches a known SPA route prefix.
 *
 * Matches if the pathname equals the route exactly, or starts with the
 * route followed by `/`. This prevents `/filesxx` from falsely matching
 * `/files` while still matching nested routes like `/reader/some-book`.
 * A trailing `/` is added to the route if it doesn't already have one,
 * so routes defined with or without a trailing slash both work correctly.
 */
export function isSpaRoutePath(pathname: string): boolean {
  return SPA_ROUTES.some((route) => pathname === route || pathname.startsWith(
    route.endsWith("/") ? route : route + "/"
        )

    )
}
