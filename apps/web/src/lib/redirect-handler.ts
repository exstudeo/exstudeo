import { isSpaRoutePath } from "../route.path"

/**
 * Parses `?redirect=` and `?fragment=` query parameters from the current URL.
 *
 * These parameters are set by:
 * - `public/404.html` (cold visit — no SW installed)
 * - The Service Worker (SW redirect for known SPA routes)
 *
 * Returns `null` if no `redirect` parameter is present.
 */
export function parseRedirectParams(): {
  /** Full target path (pathname + search + hash) to navigate to */
  targetPath: string
  /** Whether the redirect path matches a known SPA route prefix */
  isSpaRoute: boolean
} | null {
  const params = new URLSearchParams(location.search)
  const redirect = params.get("redirect")
  if (!redirect) return null

  const fragment = params.get("fragment") || ""

  // Reconstruct the target URL, preserving any text fragment directives
  // (e.g., :~:text=hello) transparently inside the hash.
  const targetPath = fragment ? `${redirect}#${fragment}` : redirect

  // Check if the redirect path starts with any known SPA route prefix.
  // Uses path-segment matching so /filesxx does not match /files,
  // but /reader/some-book still matches /reader.
  const isSpaRoute = isSpaRoutePath(redirect)

  return { targetPath, isSpaRoute }
}