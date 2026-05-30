## Why

The current EPUB route strategy only serves `.html` files with `mode: "navigate"` or `destination: "document"`. Real EPUB files contain XHTML content pages, images (JPEG, PNG, GIF, WebP), CSS stylesheets, fonts (WOFF, TTF), and XML metadata files. When an EPUB reader iframe loads these subresources, the browser fetches them with different `destination` values (`"image"`, `"style"`, `"font"`, `""`) — all of which are currently rejected by the match callback, causing broken rendering.

Additionally, the file explorer constructs `/@epubs/` URLs from raw ZenFS paths that may contain non-ASCII characters (e.g., CJK filenames). The browser percent-encodes these automatically, but the SW handler never decodes them, resulting in failed ZenFS lookups for any path with non-ASCII names.

This change generalizes the EPUB route to serve all resource types and fixes the encoding bug, making the reader functional for real-world EPUBs.

## What Changes

- **Generalize the route strategy** — drop the `request.mode`/`destination` filter and `.html` extension check; match any `GET` same-origin request under `/@epubs/`
- **Fix percent-encoding handling** — apply `decodeURIComponent()` to the rest path extracted from `url.pathname` before ZenFS lookup
- **Add MIME type mapping** — extract extension-to-MIME mapping into a shared utility (`sw-routes/mime.ts`) for the EPUB handler and future strategies
- **Serve `.opf` as XHTML** — treat `.opf` extension as `application/xhtml+xml` (required by EPUB reading systems)
- **Read files as binary** — switch from `readFile(path, "utf-8")` to raw `Uint8Array` read, supporting images and fonts; add `charset=utf-8` only for text-based MIME types
- **Rename strategy** — rename `"epub-html"` to `"epub-resources"` to reflect the broader scope
- **Update spec** — replace the current `.html`-only spec with the generalized resource-serving spec

## Capabilities

### New Capabilities
- `sw-route-mime`: MIME type mapping utility for service worker resource serving. Provides an `inferMimeType(extension: string): string` function that maps file extensions (`.html`, `.xhtml`, `.xml`, `.css`, `.js`, `.png`, `.jpg`, `.svg`, `.woff`, `.opf`, etc.) to their corresponding `Content-Type` values. Falls back to `text/plain` for unknown extensions. Handles the `.opf` → `application/xhtml+xml` special case.

### Modified Capabilities
- `sw-route-epub`: The existing EPUB HTML route strategy is generalized to serve any resource type under `/@epubs/`, not just `.html`. Requirements change: match callback accepts all `GET` requests regardless of `mode`/`destination`; handler percent-decodes the URL path; handler reads as binary and infers MIME type from extension; strategy renamed to `"epub-resources"`.

## Impact

- **`apps/web/src/sw-routes/epub.ts`**: Major rework — match callback simplified, handler updated with binary read, percent-decoding, and MIME lookup
- **`apps/web/src/sw-routes/mime.ts`** (new): MIME type mapping utility
- **`apps/web/src/sw-routes/zenfs-sw.ts`**: No changes needed (`isEpubRoutePath` already checks `/@epubs/` prefix)
- **`apps/web/src/sw.ts`**: Strategy name changes in `createEpubRouteStrategy()` import (interface unchanged)
- **`openspec/specs/sw-route-epub/spec.md`**: Replaced with generalized spec
- **`openspec/specs/sw-route-mime/spec.md`** (new): MIME utility spec
- **No new dependencies** — uses existing `@zenfs/core`, `@zenfs/dom`, `workbox-routing`