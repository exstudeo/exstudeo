# SW Route — MIME Type Mapping

## Purpose

A shared utility for inferring `Content-Type` header values from file extensions in the service worker scope. Used by route strategies (such as the EPUB resources strategy) to serve files with correct MIME types without pulling in a heavy third-party MIME library or relying on the browser's MIME detection (unavailable in SW scope).

## Requirements

### Requirement: inferMimeType maps known extensions to Content-Type

The `inferMimeType()` function SHALL accept a file extension string (including the leading dot, e.g., `.html`) and return the corresponding `Content-Type` value as a string. The function SHALL be case-insensitive: `.HTML` and `.html` SHALL return the same value.

The mapping SHALL include at minimum the following extensions:

| Extension | Content-Type |
|-----------|-------------|
| `.html` | `text/html;charset=utf-8` |
| `.xhtml` | `application/xhtml+xml;charset=utf-8` |
| `.xml` | `application/xml;charset=utf-8` |
| `.css` | `text/css;charset=utf-8` |
| `.js` | `application/javascript;charset=utf-8` |
| `.json` | `application/json;charset=utf-8` |
| `.svg` | `image/svg+xml;charset=utf-8` |
| `.png` | `image/png` |
| `.jpg` | `image/jpeg` |
| `.jpeg` | `image/jpeg` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.bmp` | `image/bmp` |
| `.ico` | `image/x-icon` |
| `.avif` | `image/avif` |
| `.ttf` | `font/ttf` |
| `.otf` | `font/otf` |
| `.woff` | `font/woff` |
| `.woff2` | `font/woff2` |
| `.mp3` | `audio/mpeg` |
| `.mp4` | `video/mp4` |
| `.webm` | `video/webm` |

#### Scenario: Maps .html to text/html
- **WHEN** `inferMimeType(".html")` is called
- **THEN** it returns `"text/html;charset=utf-8"`

#### Scenario: Maps .png to image/png
- **WHEN** `inferMimeType(".png")` is called
- **THEN** it returns `"image/png"`

#### Scenario: Is case-insensitive
- **WHEN** `inferMimeType(".HTML")` is called
- **THEN** it returns the same value as `inferMimeType(".html")`

#### Scenario: Maps .jpeg to image/jpeg
- **WHEN** `inferMimeType(".jpeg")` is called
- **THEN** it returns `"image/jpeg"`

#### Scenario: Maps .jpg to image/jpeg
- **WHEN** `inferMimeType(".jpg")` is called
- **THEN** it returns `"image/jpeg"`

#### Scenario: Maps .opf to application/xhtml+xml
- **WHEN** `inferMimeType(".opf")` is called
- **THEN** it returns `"application/xhtml+xml;charset=utf-8"`

### Requirement: Unknown extensions fall back to text/plain

The `inferMimeType()` function SHALL return `"text/plain"` for any extension not in the mapping table.

#### Scenario: Unknown extension returns text/plain
- **WHEN** `inferMimeType(".xyz")` is called
- **THEN** it returns `"text/plain"`

#### Scenario: Empty string returns text/plain
- **WHEN** `inferMimeType("")` is called
- **THEN** it returns `"text/plain"`

### Requirement: inferMimeType accepts a full file path and extracts extension

For convenience, `inferMimeType()` SHALL also accept a full file path (e.g., `"/epubs/ch1/section.xhtml"`) and extract the extension from the last segment after the final `.`. If the path has no extension (no `.` in the last segment), it SHALL fall back to `"text/plain"`.

#### Scenario: Accepts full path
- **WHEN** `inferMimeType("/epubs/ch1/section.xhtml")` is called
- **THEN** it returns `"application/xhtml+xml;charset=utf-8"`

#### Scenario: Path without extension returns text/plain
- **WHEN** `inferMimeType("/epubs/ch1/README")` is called
- **THEN** it returns `"text/plain"`