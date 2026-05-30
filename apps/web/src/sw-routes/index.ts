/**
 * Pluggable route strategy interface for the Exstudeo service worker.
 *
 * Each strategy encapsulates a named match/handler pair that can be
 * registered with Workbox's router. Strategies are registered in order —
 * first-match wins.
 *
 * @module sw-routes
 */

import type {
  RouteHandlerCallbackOptions,
  RouteMatchCallback,
  RouteHandler,
} from "workbox-core/types"
import { registerRoute } from "workbox-routing"

/**
 * A named route strategy for the service worker.
 *
 * Strategies are registered via {@link registerStrategies} in array order.
 * The `name` is used for logging and debugging only.
 */
export interface SwRouteStrategy {
  /** Human-readable name for logging (e.g. "epub-html", "spa-redirect"). */
  name: string
  /**
   * Match callback — return a truthy value to handle this request.
   * Receives the same options as Workbox's `RouteMatchCallback`.
   */
  match: RouteMatchCallback
  /**
   * Handler callback — produce a Response for the matched request.
   * Receives the request, url, event, and any params from the match callback.
   */
  handler: RouteHandler
}

/**
 * Register an ordered list of route strategies with Workbox's singleton Router.
 *
 * Each strategy is registered as a separate Workbox route, in the given order.
 * First match wins — place more specific strategies before catch-all handlers.
 *
 * @param strategies - Array of strategies to register, in priority order.
 *
 * @example
 * ```ts
 * registerStrategies([spaRedirect, validatePage, epubHtml, notFound])
 * ```
 */
export function registerStrategies(strategies: SwRouteStrategy[]): void {
  for (const s of strategies) {
    registerRoute(s.match, s.handler)
  }
}

// Re-export types for convenience
export type { RouteHandlerCallbackOptions, RouteMatchCallback, RouteHandler }

/**
 * Renders an HTML template by replacing `{{key}}` placeholders with values.
 *
 * This is a safe alternative to DOMParser (which is unavailable in some
 * Service Worker environments). All template content is controlled by us
 * and values are plain text, making this XSS-safe.
 *
 * NOTE: This can be upgraded to `with { type: 'html' }` static imports when
 * Vite and Workbox's injectManifest pipeline support it.
 */
export function renderTemplate(template: string, bindings: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(bindings)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value)
  }
  return result
}
