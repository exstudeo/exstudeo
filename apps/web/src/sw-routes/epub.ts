/**
 * EPUB resources route strategy — serves `/@epubs/*` from ZenFS.
 *
 * Intercepts GET requests to `/<origin>/@epubs/<rest_path>` for any
 * resource type (HTML, XHTML, images, CSS, fonts, etc.), resolves the
 * file from the user's mounted directories via the SW-side ZenFS instance,
 * infers the correct MIME type from the extension, and serves it.
 *
 * For HTML/XHTML responses, the handler injects the viewer stylesheet
 * link and viewer module script via lightweight string-based transforms
 * (no WASM, no `import.meta` — the SW runs as a classic script).
 * Publisher script/style sanitization is performed client-side by
 * the viewer script using `DOMParser`.
 *
 * Percent-encodes in the URL path are decoded before ZenFS lookup,
 * supporting non-ASCII filenames (CJK, accented, etc.).
 *
 * @module epub-resources
 */

import type { SwRouteStrategy, RouteHandlerCallbackOptions } from "./index"
import { renderTemplate } from "./index"
import {
  ensureZenFS,
  zenfsPromises,
} from "./zenfs-sw"
import { getConfig } from "../lib/config-store"
import { inferMimeType } from "./mime"
import notFoundTemplate from "../sw-templates/sw-not-found.html?raw"

// ── Path utilities ────────────────────────────────────────────────────────

/**
 * Join path segments safely, normalising `..`, `.`, and double slashes.
 *
 * This prevents directory traversal: `..` segments are only allowed as
 * long as they don't escape the base path. The result is always a normalised
 * absolute path starting with `/`.
 */
function joinPaths(...segments: string[]): string {
  const parts: string[] = []
  for (const segment of segments) {
    for (const part of segment.split("/")) {
      if (part === "" || part === ".") continue
      if (part === "..") {
        // Only pop if there's something to pop — prevents escaping root
        if (parts.length > 0) parts.pop()
      } else {
        parts.push(part)
      }
    }
  }
  return "/" + parts.join("/")
}

// ── HTML Injection helpers ─────────────────────────────────────────────────

/** Viewer stylesheet link to inject into `<head>`. */
const VIEWER_CSS_TAG =
  '<link rel="stylesheet" href="/epub-assets/epub-style.css">'

/** Viewer module script to inject before `</body>`. */
const VIEWER_JS_TAG =
  '<script type="module" src="/epub-assets/epub-viewer.js"></script>'

/**
 * Inject viewer CSS and JS into an HTML string.
 *
 * Simple string-based injection — no DOM parser, no WASM.
 *
 * @param html  Raw HTML bytes as UTF-8.
 * @returns Transformed HTML bytes.
 */
function injectViewerAssets(html: Uint8Array): Uint8Array<ArrayBuffer> {
  const decoder = new TextDecoder("utf-8")
  const encoder = new TextEncoder()
  let str = decoder.decode(html)

  // Inject CSS into <head>
  if (str.includes("<head")) {
    str = str.replace(/<head[^>]*>/i, (match) => match + VIEWER_CSS_TAG)
  } else if (str.includes("<html")) {
    str = str.replace(
      /<html[^>]*>/i,
      (match) => match + `<head>${VIEWER_CSS_TAG}</head>`,
    )
  }

  // Inject JS before </body>
  if (str.includes("</body>")) {
    str = str.replace("</body>", VIEWER_JS_TAG + "</body>")
  } else {
    str += VIEWER_JS_TAG
  }

  const encoded = encoder.encode(str)
  const out = new Uint8Array(encoded.length)
  out.set(encoded)
  return out
}

// ── Strategy factory ──────────────────────────────────────────────────────

/**
 * Create the EPUB resources route strategy.
 */
export function createEpubRouteStrategy(): SwRouteStrategy {
  return {
    name: "epub-resources",

    match: ({ request, url }) => {
      if (url.origin !== self.location.origin) return false
      if (request.method !== "GET") return false
      if (!url.pathname.startsWith("/@epubs/")) return false
      return true
    },

    handler: async ({ url }: RouteHandlerCallbackOptions): Promise<Response> => {
      try {
        await ensureZenFS()

        const config = await getConfig("epub")
        const zenFSPath = config.zenFSPath

        const rawPath = url.pathname.slice("/@epubs/".length)
        const restPath = decodeURIComponent(rawPath)

        const fullPath = joinPaths(zenFSPath, restPath)

        const raw: Uint8Array = await zenfsPromises.readFile(fullPath)
        let content = new Uint8Array(raw.length)
        content.set(raw)

        const mime = inferMimeType(restPath)

        // ── HTML/XHTML → inject viewer assets ────────────────────────
        // Only inject into actual book content pages, not epubdir
        // metadata files (sidebar.html, book.json, etc.) which are
        // fetched by the viewer script. Also always serve EPUB pages
        // as text/html (never application/xhtml+xml) because Chromium
        // doesn't support <script type="module"> in XML mode
        // (crbug.com/717643).
        let responseContentType = mime
        if (
          isHtmlContentType(mime) &&
          !isEpubdirMetadata(restPath)
        ) {
          responseContentType = "text/html;charset=utf-8"
          try {
            content = injectViewerAssets(content)
          } catch (err) {
            console.warn(
              `[EpubRoute] Viewer injection failed for "${restPath}":`,
              err instanceof Error ? err.message : String(err),
            )
            content = new Uint8Array(raw.length)
            content.set(raw)
          }
        }

        return new Response(content, {
          status: 200,
          headers: { "Content-Type": responseContentType },
        })
      } catch (err) {
        return create404Response(
          url.href,
          err instanceof Error ? err.message : String(err),
        )
      }
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function isHtmlContentType(contentType: string): boolean {
  return (
    contentType.startsWith("text/html") ||
    contentType.startsWith("application/xhtml+xml")
  )
}

/** Files inside epubdir that should NOT get viewer assets injected. */
const EPUBDIR_METADATA_FILES = new Set([
  "sidebar.html",
  "book.json",
  "toc.json",
  "spine.json",
])

/**
 * Check whether a ZenFS path points to an epubdir metadata file
 * that should skip viewer asset injection.
 */
function isEpubdirMetadata(restPath: string): boolean {
  const filename = restPath.split("/").pop() ?? ""
  return EPUBDIR_METADATA_FILES.has(filename)
}

function create404Response(url: string, reason: string): Response {
  const body = renderTemplate(notFoundTemplate, { url, reason })
  return new Response(body, {
    status: 404,
    headers: { "Content-Type": "text/html;charset=utf-8" },
  })
}
