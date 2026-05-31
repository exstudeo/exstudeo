**Prerequisite**: `refactor-epubdir-convention` must be applied first (this change writes `spine.json`, `toc.json`, `sidebar.html` into `.epubdir/`).

## 1. Setup

- [x] 1.1 Install `worker-tools/html-rewriter` as a dev dependency in `apps/web/package.json`
- [x] 1.2 Configure Vite multi-entry build: add `src/viewer/epub-viewer.ts` as a rollup input, output to `dist/epub-assets/epub-viewer.js`
- [x] 1.3 Create module directory `src/sw-routes/html-rewrite/` with barrel export `index.ts`
- [x] 1.4 Create module directory `src/viewer/` for the viewer script source
- [x] 1.5 Create module directory `src/lib/epub-lib/book-parser.ts` for book structure parsing

## 2. HTML Rewrite Pipeline — Types & Handle

- [x] 2.1 Define `HtmlTransformStrategy` interface and `EpubPageContext` type in `src/sw-routes/html-rewrite/types.ts`
- [x] 2.2 Implement `HtmlTransformHandle` class wrapping `html-rewriter` — expose `on(selector, handlers)` API with full lol-html element/comment/text handler support
- [x] 2.3 Implement `HtmlRewritePipeline` class — accepts `HtmlTransformStrategy[]`, provides `transform(htmlBytes, ctx)` method that applies strategies in order
- [x] 2.4 Export `defaultEpubPipeline()` factory returning `[SanitizeStrategy, InjectStylesStrategy, InjectViewerStrategy]`

## 3. HTML Rewrite Pipeline — Strategies

- [x] 3.1 Implement `SanitizeStrategy`: remove all `<script>`, `<style>`, inline `style=""`, inline event handler attributes (`onclick`, `onload`, etc.), and strip `href` from `<link rel="stylesheet">`
- [x] 3.2 Implement `InjectStylesStrategy`: append `<link rel="stylesheet" href="/epub-assets/epub-style.css">` to `<head>`, create `<head>` if missing
- [x] 3.3 Implement `InjectViewerStrategy`: append `<script type="module" src="/epub-assets/epub-viewer.js"></script>` before `</body>`

## 4. HTML Rewrite — XHTML Compatibility Tests

- [x] 4.1 Write vitest test: html-rewriter handles `<?xml version=\"1.0\"?>` preamble in EPUB2 XHTML
- [x] 4.2 Write vitest test: html-rewriter handles self-closing tags like `<br/>`, `<img/>`
- [x] 4.3 Write vitest test: html-rewriter preserves `epub:type` attributes
- [x] 4.4 Write vitest test: SanitizeStrategy correctly strips scripts and event handlers
- [x] 4.5 Write vitest test: pipeline applies strategies in order (integration test with mock strategies)

## 5. Book Structure Parser

- [x] 5.1 Define `SpineItem` and `TocNode` types in `src/lib/epub-lib/book-parser.ts`
- [x] 5.2 Implement `parseSpine(opfDoc)`: querySelectorAll on OPF `<spine><itemref>`, resolve href from manifest
- [x] 5.3 Implement `parseTocNav(navDoc)`: querySelector `nav[epub\\:type=\"toc\"] ol`, recursively walk `<li><a><ol>` for EPUB3
- [x] 5.4 Implement `parseTocNcx(ncxDoc)`: TreeWalker over `navMap > navPoint`, extract `navLabel/text` and `content/@src`, resolve hrefs relative to NCX directory
- [x] 5.5 Implement `parseBookStructure(entries, metadata)`: dispatches to spine + TOC parsers, resolves NCX/NAV paths from OPF, returns `BookStructure { spine, toc, sidebarHtml }`
- [x] 5.6 Implement `generateSidebarHtml(toc)`: walk TOC tree, emit `<nav class=\"ex-toc\"><ol><li><a href=\"...\">` with `<details open>` for collapsible sections, path-relative hrefs
- [x] 5.7 Handle missing NCX/NAV gracefully: empty TOC with placeholder sidebar

## 6. epub-style.css

- [x] 6.1 Define CSS custom properties: `--ex-bg`, `--ex-fg`, `--ex-border`, `--ex-sidebar-bg`, `--ex-sidebar-fg`, `--ex-link`, `--ex-current-bg`, font stack
- [x] 6.2 Implement grid layout: body as grid container, `.ex-sidebar` at 280px, `.ex-content` fills remaining space
- [x] 6.3 Implement reading typography: serif font, 16px base, line-height 1.7, max-width 65ch, auto margins on content
- [x] 6.4 Implement sidebar styles: sticky, overflow-y auto, border-right, padding
- [x] 6.5 Implement TOC styles: `.ex-toc ol` (list-style none, padding), `.ex-toc a` (text-decoration none, block, padding), `.ex-toc a.ex-current` (highlighted background), `<details>` styling
- [x] 6.6 Implement mobile responsive: media query at 768px, `.ex-sidebar` becomes fixed slide-in drawer with `transform: translateX(-100%)`, `.ex-sidebar.open` slides in
- [x] 6.7 Implement dark mode: `@media (prefers-color-scheme: dark)` reassigns custom properties
- [x] 6.8 Publisher CSS reset: normalize common EPUB publisher styles that clash with viewer layout (body margins, max-width on content containers, etc.)

## 7. epub-viewer.ts (Vite Entry Point)

- [x] 7.1 Implement URL parsing: extract `.epubdir` prefix from `location.href` by finding the last `.epubdir` segment
- [x] 7.2 Implement sidebar link rewriting: after parsing `sidebar.html`, rewrite all `<a href>` to absolute URLs by prepending the epubdir base URL (skip already-absolute URLs and fragment-only links)
- [x] 7.3 Implement page title resolution: fetch `./book.json` + `./toc.json`, find TOC match → h1 → existing title → filename fallback
- [x] 7.4 Implement `document.title` and `og:title` meta tag setting
- [x] 7.5 Implement sidebar injection: fetch `./sidebar.html`, parse with DOMParser, wrap original body content in `<main class="ex-content">`, prepend `<nav class="ex-sidebar">`
- [x] 7.6 Implement current chapter highlighting: match sidebar `<a href>` (now absolute) against `location.href`, add `ex-current` class
- [x] 7.7 Implement mobile sidebar toggle: add hamburger button, wire click to toggle `.ex-sidebar.open`
- [x] 7.8 Handle error cases: missing sidebar.html (empty nav), missing book.json (fallback title from filename), missing toc.json (fallback title from h1/filename)

## 8. Integration — SW EPUB Route

- [x] 8.1 Import `HtmlRewritePipeline` and `defaultEpubPipeline` into `src/sw-routes/epub.ts`
- [x] 8.2 In the handler, detect HTML/XHTML responses by checking `contentType.startsWith("text/html")` or `contentType.startsWith("application/xhtml+xml")`
- [x] 8.3 Run the pipeline on the response body before constructing the `Response` object
- [x] 8.4 Ensure non-HTML responses (images, fonts, JSON, CSS) skip the pipeline

## 9. Integration — ViewModel Upload Pipeline

- [x] 9.1 Import `parseBookStructure` into `src/lib/epub-lib/view-model.ts`
- [x] 9.2 Call `parseBookStructure()` in `AddEpubsExtracted` after extraction, before writing files
- [x] 9.3 Write `spine.json`, `toc.json`, and `sidebar.html` into `.epubdir/` alongside `book.epub` and `book.json`
- [x] 9.4 Handle `parseBookStructure` failure: treat as extraction failure, clean up epubdir, report in failure summary

## 10. Vite Config & Build Verification

- [x] 10.1 Verify multi-entry build produces `dist/epub-assets/epub-viewer.js` alongside the main app bundle
- [x] 10.2 Verify `epub-viewer.js` uses only browser-compatible APIs (no Node.js imports)
- [x] 10.3 Verify the viewer script is served correctly at `/epub-assets/epub-viewer.js` (either via Vite dev server in dev, or precache/sw in production)
- [x] 10.4 Verify `epub-style.css` is served at `/epub-assets/epub-style.css`

## 11. End-to-End Validation

- [x] 11.1 Upload a test EPUB, verify `.epubdir/` contains `spine.json`, `toc.json`, and `sidebar.html` with valid content
- [x] 11.2 Navigate to an EPUB chapter URL, verify the page has sidebar + content layout
- [x] 11.3 Verify `document.title` is set correctly (book name + page name)
- [x] 11.4 Verify sidebar TOC links navigate to correct chapters
- [x] 11.5 Verify current chapter is highlighted in sidebar
- [x] 11.6 Test on mobile viewport: sidebar hidden by default, toggle works
- [x] 11.7 Test with EPUB 2 (NCX-based TOC) and EPUB 3 (NAV-based TOC)
- [x] 11.8 Run `npm run typecheck` from monorepo root
- [x] 11.9 Run `cd apps/web && npm run test:run` and verify all tests pass
- [x] 11.10 Update `Development.log.md` with summary