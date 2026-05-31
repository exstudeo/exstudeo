## MODIFIED Requirements

### Requirement: Handler percent-decodes the path and resolves from ZenFS

The handler SHALL read the `epub.zenFSPath` configuration from IndexedDB via the existing `getConfig("epub")` API. The default value is `"/epubs"`. The `restPath` is extracted from the URL by removing the `/@epubs/` prefix, then percent-decoded via `decodeURIComponent()`. The full ZenFS path is computed by joining `zenFSPath` and the decoded `restPath` with a normalizing path joiner that prevents directory traversal (`..` segments).

For responses with `Content-Type` starting with `text/html` or `application/xhtml+xml`, the handler SHALL run the HTML rewrite pipeline (the default pipeline from `defaultEpubPipeline()`) before returning the response. Non-HTML responses (images, fonts, CSS, JSON) SHALL be returned without transformation.

#### Scenario: HTML file transformed by pipeline
- **WHEN** the requested file has extension `.html` or `.xhtml`
- **THEN** the response body is transformed by `HtmlRewritePipeline` with the default strategy set
- **AND** the transformed response contains the injected `<link>` to `epub-style.css` and `<script>` to `epub-viewer.js`

#### Scenario: Non-HTML file served without transformation
- **WHEN** the requested file has extension `.jpg` or `.css` or `.json`
- **THEN** the response is returned as-is, without HTML rewriting

#### Scenario: Percent-decodes CJK path
- **WHEN** the URL is `/@epubs/%E6%96%B0%E5%BB%BA%E6%96%87%E4%BB%B6%E5%A4%B9/section.html` and `zenFSPath` is `"/epubs"`
- **THEN** the decoded rest path is `"新建文件夹/section.html"`
- **AND** the computed full path is `"/epubs/新建文件夹/section.html"`

#### Scenario: Joins paths correctly
- **WHEN** the URL is `/@epubs/ch1/section.html` and `zenFSPath` is `"/epubs"`
- **THEN** the computed full path is `"/epubs/ch1/section.html"`

#### Scenario: Prevents path traversal
- **WHEN** the URL is `/@epubs/../../config.json`
- **THEN** the path joiner prevents traversal, and the resulting path stays within the zenFSPath tree

### Requirement: Handler infers MIME type and reads file as binary

The handler SHALL use `inferMimeType()` from `sw-routes/mime.ts` to determine the `Content-Type` header based on the file extension (or full path). The handler SHALL read the file at the computed full ZenFS path using `zenfsPromises.readFile(fullPath)` (no encoding argument, returns `Uint8Array`). If the file exists, it SHALL return a 200 response with the inferred `Content-Type` header. For HTML/XHTML responses, the body SHALL be transformed through the HTML rewrite pipeline before the response is constructed. If the file read fails (file not found or other error), the handler SHALL return a styled 404 page with the error reason interpolated into the `{{url}}` and `{{reason}}` placeholders.

#### Scenario: HTML file served with correct content type and transformed
- **WHEN** the file `"/epubs/book.html"` exists in ZenFS
- **THEN** the response status is 200
- **AND** the `Content-Type` header is `"text/html;charset=utf-8"`
- **AND** the response body contains the sanitized and injected content

#### Scenario: XHTML file served with correct content type and transformed
- **WHEN** the file `"/epubs/ch1/content.xhtml"` exists in ZenFS
- **THEN** the response status is 200
- **AND** the `Content-Type` header is `"application/xhtml+xml;charset=utf-8"`
- **AND** the response body has been transformed through the HTML rewrite pipeline

#### Scenario: Image file served with correct content type
- **WHEN** the file `"/epubs/images/cover.jpg"` exists in ZenFS
- **THEN** the response status is 200
- **AND** the `Content-Type` header is `"image/jpeg"`
- **AND** the response body contains the raw binary image data (not transformed)

#### Scenario: OPF file served as application/xhtml+xml
- **WHEN** the file `"/epubs/book.opf"` exists in ZenFS
- **THEN** the response status is 200
- **AND** the `Content-Type` header is `"application/xhtml+xml;charset=utf-8"`

#### Scenario: Unknown extension served as text/plain
- **WHEN** the file `"/epubs/resource.xyz"` exists in ZenFS
- **THEN** the response status is 200