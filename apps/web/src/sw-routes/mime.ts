/**
 * MIME type inference utility for the Exstudeo service worker.
 *
 * Maps file extensions to `Content-Type` header values without relying on
 * a third-party MIME library. Used by route strategies (e.g., EPUB resources)
 * to serve files with correct MIME types.
 *
 * Accepts both bare extensions (`.html`, `.png`) and full file paths
 * (`/epubs/ch1/section.xhtml`). Case-insensitive. Falls back to `text/plain`
 * for unknown or missing extensions.
 *
 * @module sw-route-mime
 */

// ── MIME mapping table ────────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  // Text / markup
  ".html": "text/html;charset=utf-8",
  ".htm": "text/html;charset=utf-8",
  ".xhtml": "application/xhtml+xml;charset=utf-8",
  ".xml": "application/xml;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".svg": "image/svg+xml;charset=utf-8",

  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",

  // Fonts
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",

  // Audio / video
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",

  // EPUB-specific
  ".opf": "application/xhtml+xml;charset=utf-8",
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Infer the `Content-Type` header value from a file extension or full path.
 *
 * Accepts an extension with leading dot (`.html`, `.png`) or a full file path
 * (`/epubs/ch1/section.xhtml`). The lookup is case-insensitive.
 *
 * @param pathOrExtension - File extension (e.g. `.html`) or full file path
 *                          (e.g. `/epubs/ch1/section.xhtml`).
 * @returns The MIME type string (e.g. `"text/html;charset=utf-8"`), or
 *          `"text/plain"` if the extension is unknown or missing.
 *
 * @example
 * ```ts
 * inferMimeType(".html")        // "text/html;charset=utf-8"
 * inferMimeType(".PNG")         // "image/png"
 * inferMimeType("image.jpg")    // "image/jpeg"
 * inferMimeType("/path/file")   // "text/plain" (no extension)
 * inferMimeType(".xyz")         // "text/plain" (unknown)
 * inferMimeType(".opf")         // "application/xhtml+xml;charset=utf-8"
 * ```
 */
export function inferMimeType(pathOrExtension: string): string {
  // Extract the extension from the last `.` in the last path segment.
  // This handles both bare extensions (`.html`) and full paths (`/a/b/c.html`).
  const lastSegment = pathOrExtension.split("/").pop() ?? ""
  const dotIndex = lastSegment.lastIndexOf(".")
  const ext = dotIndex >= 0 ? lastSegment.slice(dotIndex) : ""

  // Case-insensitive lookup
  return MIME_MAP[ext.toLowerCase()] ?? "text/plain"
}