# SW Route — EPUB HTML

## Purpose

A service worker route strategy that intercepts GET requests to `https://<origin>/@epubs/<rest_path>` where `<rest_path>` ends with `.html`, resolves the ZenFS file path from the configured `zenFSPath`, reads the file from the user's mounted directory, and serves it as HTML. If the file or mount is unavailable, it returns a styled 404 page.

## Requirements

### Requirement: EpubRouteStrategy is a named SwRouteStrategy

The EPUB HTML interceptor SHALL be implemented as a function `createEpubRouteStrategy()` that returns an `SwRouteStrategy` object conforming to the interface defined in `sw-routes/index.ts`. The strategy name SHALL be `"epub-html"`.

#### Scenario: Strategy exports with correct shape
- **WHEN** `createEpubRouteStrategy()` is called
- **THEN** it returns an object with `name: "epub-html"`, a `match` function, and a `handler` function

### Requirement: Match intercepts GET /@epubs/*.html for navigate and document requests

The `match` callback SHALL return `true` only when all of the following hold: the request origin matches the SW's origin, the request method is `GET`, the request is either `mode: "navigate"` or `destination: "document"`, the URL pathname starts with `/@epubs/`, and the pathname ends with `.html`.

#### Scenario: Matches navigate request to /@epubs/book.html
- **WHEN** a navigation request is made to `https://example.com/@epubs/book.html`
- **THEN** the match callback returns `true`

#### Scenario: Matches document fetch request to /@epubs/book.html
- **WHEN** a request with `destination: "document"` is made to `https://example.com/@epubs/book.html`
- **THEN** the match callback returns `true`

#### Scenario: Rejects non-html path
- **WHEN** a navigation request is made to `https://example.com/@epubs/book.xhtml`
- **THEN** the match callback returns `false`

#### Scenario: Rejects path not under /@epubs/
- **WHEN** a navigation request is made to `https://example.com/epubs/book.html`
- **THEN** the match callback returns `false`

#### Scenario: Rejects cross-origin request
- **WHEN** a navigation request is made to `https://other.com/@epubs/book.html`
- **THEN** the match callback returns `false`

### Requirement: Handler resolves zenFSPath from config

The handler SHALL read the `epub.zenFSPath` configuration from IndexedDB via the existing `getConfig("epub")` API. The default value is `"/epubs"`. The `restPath` is extracted from the URL by removing the `/@epubs/` prefix. The full ZenFS path is computed by joining `zenFSPath` and `restPath` with a normalizing path joiner that prevents directory traversal (`..` segments).

#### Scenario: Joins paths correctly
- **WHEN** the URL is `/@epubs/ch1/section.html` and `zenFSPath` is `"/epubs"`
- **THEN** the computed full path is `"/epubs/ch1/section.html"`

#### Scenario: Prevents path traversal
- **WHEN** the URL is `/@epubs/../../config.json.html`
- **THEN** the path joiner prevents traversal, and the resulting path stays within the zenFSPath tree
- **AND** the path ends with `.html` as required by the match callback

### Requirement: Handler finds the longest matching mountPath

The handler SHALL enumerate the mounted paths under ZenFS root `/`, find those that are a prefix of `zenFSPath`, and select the one with the longest match. If no mount matches, the handler SHALL return a styled 404 page (from `sw-not-found.html` template) with the reason included.

#### Scenario: Longest prefix match wins
- **WHEN** both `/` and `/epubs` are mounted, and `zenFSPath` is `"/epubs"`
- **THEN** `/epubs` is selected as the matching mount (6 chars vs 1 char)

#### Scenario: No matching mount returns 404
- **WHEN** only `/notes` is mounted and `zenFSPath` is `"/epubs"`
- **THEN** no mount path is a prefix of `"/epubs"`
- **AND** the response is a styled 404 page

### Requirement: Handler reads the file from ZenFS and serves as HTML

The handler SHALL read the file at the computed full ZenFS path using `promises.readFile(fullZenPath, "utf-8")`. If the file exists, it SHALL return a 200 response with `Content-Type: text/html;charset=utf-8`. If the read fails (file not found or other error), the handler SHALL return a styled 404 page with the error reason interpolated into the `{{url}}` placeholder and a `{{reason}}` placeholder added.

#### Scenario: File exists and is served as HTML
- **WHEN** the file `"/epubs/book.html"` exists in ZenFS
- **THEN** the response status is 200
- **AND** the `Content-Type` header is `text/html;charset=utf-8`
- **AND** the response body contains the file content

#### Scenario: Missing file returns 404
- **WHEN** the file `"/epubs/missing.html"` does not exist in ZenFS
- **THEN** the response status is 404
- **AND** the response body contains a styled HTML page with the reason

### Requirement: Route is registered after SPA redirect but before 404 catch-all

The EPUB route strategy SHALL be registered after the SPA redirect handler and validation page handler, but before the 404 catch-all. Registration order is determined by the order strategies are passed to `registerStrategies()`, which internally calls `registerRoute()` in sequence.

#### Scenario: Registration order is correct
- **WHEN** all route strategies are registered
- **THEN** the order is: SPA redirect → validation → EPUB html → 404 catch-all
