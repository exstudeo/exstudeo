/// <reference lib="webworker" />
/// <reference types="vite/client" />

import { createHandlerBoundToURL, precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"
import { isSpaRoutePath } from "./route.path"
import { renderTemplate, registerStrategies } from "./sw-routes/index"
import { createEpubRouteStrategy } from "./sw-routes/epub"
import { markMountsDirty, isEpubRoutePath } from "./sw-routes/zenfs-sw"
import notFoundTemplate from "./sw-templates/sw-not-found.html?raw"
import validateTemplate from "./sw-templates/sw-validate.html?raw"

// cast self to the correct type with __WB_MANIFEST
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

/** Returns true if the request is a navigation to an unknown (non-SPA) path. */
function isUnknownNavigation(request: Request, url: URL): boolean {
  if (request.mode !== "navigate") return false
  // Root path (including with ?redirect= params) is handled by precache
  if (url.pathname === "/") return false
  // Known SPA routes are handled by the SPA route handler
  if (isSpaRoutePath(url.pathname)) return false
  // Validation route has its own handler
  if (url.pathname === "/validate_service_worker.html") return false
  // EPUB resources routes are handled by the EPUB route strategy
  if (isEpubRoutePath(url.pathname)) return false
  return true
}


const manifest = self.__WB_MANIFEST

// In dev mode the manifest is empty — no precaching happens, and the dev
// server handles all requests. Skip the custom routing in that case.
if (manifest && manifest.length > 0) {
  precacheAndRoute(manifest)
  cleanupOutdatedCaches()


  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      denylist: [/^\/api\//, /\.json$/],
    })
  )

  // ── 1. SPA route handler ────────────────────────────────────────────────
  // Serve the precached app shell directly for known SPA routes, keeping
  // the original URL intact so React Router can match and render the
  // correct page. Avoids Response.redirect(), which is unreliable offline
  // in Chromium (redirect target may fail to render).
  registerRoute(
    ({ request, url }) =>
      request.mode === "navigate" && isSpaRoutePath(url.pathname),
    async ({ url }) => {

      // The precache manifest stores the app shell as "index.html", not as "/". matchPrecache("/index.html") resolves to the correct cache key; matchPrecache("/") would not find a match.
      // another possible solution would to use `vite-plugin-pwa/pwaOptions.navigationFallback` with `navigateFallbackAllowlist` to let workbox handle this.
      const response = await matchPrecache("/index.html")
      if (response) { return response }



      // Fallback: if the precached entry point isn't available, return a minimal error response
      return new Response('App shell not available offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      })


    },
  )

  // ── 2. Validation page handler ────────────────────────────────────────
  // Serve a diagnostic page at /validate_service_worker.html.
  registerRoute(
    ({ request, url }) =>
      request.mode === "navigate" && url.pathname === "/validate_service_worker.html",
    async ({ request, url }) => {
      try {
        const requestInfo = JSON.stringify(
          {
            url: url.href,
            method: request.method,
            referrer: request.referrer,
            mode: request.mode,
            destination: request.destination,
            headers: Object.fromEntries([...request.headers.entries()]),
          },
          null,
          2,
        )
        const body = renderTemplate(validateTemplate, { requestInfo })
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/html;charset=utf-8" },
        })
      } catch (err) {
        console.error("SW validation handler error:", err)
        return new Response(`SW Error: ${err}`, {
          status: 500,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
        })
      }
    },
  )

  // ── 3. EPUB resources route ────────────────────────────────────────────
  // Serve `/@epubs/*` files from the user's ZenFS-mounted directories.
  registerStrategies([createEpubRouteStrategy()])

  // ── 4. 404 catch-all ──────────────────────────────────────────────────
  // Catches navigations that don't match any known route (root, SPA,
  // validation, or EPUB). Genuinely unknown paths get the SW 404 page.
  registerRoute(
    ({ request, url }) => isUnknownNavigation(request, url),
    async ({ url }) => {
      try {
        const body = renderTemplate(notFoundTemplate, { url: url.href })
        return new Response(body, {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "text/html;charset=utf-8" },
        })
      } catch (err) {
        console.error("SW 404 handler error:", err)
        return new Response(`SW 404 Error: ${err}`, {
          status: 500,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
        })
      }
    },
  )

  // ── 5. PostMessage handler ──────────────────────────────────────────────
  // Listen for mount change notifications from the frontend.
  self.addEventListener("message", (event) => {
    if (event.data?.type === "zenfs-reload") {
      markMountsDirty()
    }
  })
}

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", () => {
  self.clients.claim()
})