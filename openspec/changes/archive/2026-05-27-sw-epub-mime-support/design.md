## Context

The EPUB route strategy (`sw-routes/epub.ts`) currently intercepts only `GET /@epubs/*.html` requests with `mode: "navigate"` or `destination: "document"`. It reads the file as UTF-8 text and serves it as `text/html`. This was sufficient for initial EPUB HTML navigation, but real EPUB readers need subresources: XHTML content documents, images, CSS, fonts, and XML metadata.

Real-world EPUBs contain:
- `.xhtml` content documents (standard EPUB3)
- `.opf` package documents (served as XHTML for reader consumption)
- `.xml` metadata files (container.xml, toc.ncx)
- `.css` stylesheets
- `.png`, `.jpg`, `.gif`, `.webp` images
- `.ttf`, `.otf`, `.woff`, `.woff2` fonts
- `.svg` vector graphics

These arrive at the SW with various `destination` and `mode` values that the current match callback rejects. Additionally, `readFile(..., "utf-8")` corrupts binary data (images, fonts).

A second issue is that the file explorer constructs `/@epubs/` URLs from ZenFS file paths that may contain non-ASCII characters (CJK, accented, etc.). The browser percent-encodes the URL, but the SW never decodes it, causing ZenFS to look up the percent-encoded path literally.

## Goals / Non-Goals

**Goals:**
- Generalize the match callback to accept all `GET` same-origin requests under `/@epubs/` regardless of `mode` or `destination`
- Fix percent-encoding: decode `restPath` from `url.pathname` before ZenFS lookup
- Switch to binary read (`Uint8Array`) to support images, fonts, and other binary resources
- Create a MIME type inference utility (`sw-routes/mime.ts`) mapping extensions to `Content-Type` values
- Serve `.opf` files as `application/xhtml+xml` (required for EPUB reading systems)
- Fall back to `text/plain` for unknown extensions
- Rename strategy from `"epub-html"` to `"epub-resources"`
- Update the existing sw-route-epub spec; create a new sw-route-mime spec

**Non-Goals:**
- Caching strategy for EPUB resources (out of scope; plain SW fetch is sufficient)
- Range request support (not needed for current EPUB reading approach)
- Other route strategies (e.g., `/@ghgist/`) — future work
- Streaming large files — `readFile` loads the whole file into memory, acceptable for typical EPUB resources
- Compression or transcoding of served resources

## Decisions

### Decision: Drop mode/destination filter in match callback

- **Choice**: The match callback only checks `origin`, `method` (`GET`), and `pathname` (`startsWith("/@epubs/")`). No filter on `request.mode` or `request.destination`.
- **Rationale**: EPUB subresources arrive with various destination values — `"image"`, `"style"`, `"font"`, `"script"`, or empty string for programmatic fetches. Filtering would require maintaining a complete allowlist that would need updating for every new resource type. Since any request under `/@epubs/` is explicitly routed by the app, there's no security risk in accepting them all.
- **Alternative considered**: Maintain a destination allowlist — rejected because it's brittle and needs updates for new resource types.

### Decision: Always read as binary, set charset only for text types

- **Choice**: Use `zenfsPromises.readFile(fullPath)` (no encoding) which returns `Uint8Array`. For text-based MIME types (HTML, XHTML, XML, CSS, JS, SVG), append `;charset=utf-8` to the Content-Type. For binary types (images, fonts), omit charset.
- **Rationale**: One code path. Works for both text and binary. `Response` accepts `Uint8Array` directly.
- **Alternative considered**: Branch on extension — read as text for known text types, binary for others — rejected because the binary path handles text fine and avoids double branching.

### Decision: Extract MIME mapping to dedicated utility

- **Choice**: Create `sw-routes/mime.ts` exporting `inferMimeType(extension: string): string` with a comprehensive mapping table and `text/plain` fallback.
- **Rationale**: Clean separation. The mapping is self-contained, testable, and reusable by future route strategies (e.g., a Gist strategy serving `.md` files).
- **Alternative considered**: Inline map in `epub.ts` — rejected because it duplicates across strategies and is harder to unit-test.

### Decision: Decode URI components on the rest path

- **Choice**: Apply `decodeURIComponent()` to the `restPath` extracted from `url.pathname` before passing it to `joinPaths()`.
- **Rationale**: `url.pathname` is always percent-encoded by the browser. ZenFS paths are decoded UTF-8 strings. Without decoding, paths with CJK, accented, or other non-ASCII characters fail to resolve.
- **Alternative considered**: `decodeURI()` (which doesn't decode `%23`, `%3F`, etc.) — rejected because we want full decoding for filesystem paths that could contain `#` or `?` as literal characters.

### Decision: `.opf` mapped to `application/xhtml+xml`

- **Choice**: The `.opf` extension maps to the same MIME type as `.xhtml`: `application/xhtml+xml;charset=utf-8`.
- **Rationale**: EPUB `.opf` files (package documents) are XML files that are commonly consumed by E-reading systems that expect XHTML. Treating them as XHTML allows EPUB reader iframes to render them directly.
- **Alternative considered**: Map `.opf` to `application/xml` — rejected because the EPUB reader system needs XHTML for proper rendering.

### Decision: Rename strategy to `"epub-resources"`

- **Choice**: The strategy name changes from `"epub-html"` to `"epub-resources"`.
- **Rationale**: The strategy no longer serves only HTML. The new name accurately reflects that it handles all resource types under the `/@epubs/` namespace.
- **Alternative considered**: Keep `"epub-html"` — rejected because it's misleading.

## Risks / Trade-offs

- **[Large binary files]** A 50MB JPEG or font file is loaded entirely into memory. → **Mitigation**: Typical EPUB resources are small (<5MB). If this becomes a bottleneck, streaming reads can be added later. The existing pattern already loads files fully.
- **[Unexpected extensions]** An EPUB may reference resources with unusual extensions. → **Mitigation**: Falls back to `text/plain` which is safe — the browser will either handle it or show a download prompt.
- **[Security: MIME sniffing]** Serving unknown extensions as `text/plain` prevents XSS via MIME-type confusion. → **Mitigation**: `text/plain` prevents script execution. XHR/fetch responses are subject to CORS, and the SW only intercepts same-origin requests under a controlled namespace.
- **[Breaking change]** The existing `"epub-html"` strategy name appears only in `sw.ts` registration. → **Mitigation**: No external consumers; update the one import site.