## Context

Currently, EPUB content pages served by the service worker are raw publisher HTML — no sanitization, no reading layout, no navigation. The user sees whatever the publisher embedded. The EPUB Explorer already manages book metadata and unzipped content, but there's no reader experience.

The `refactor-epubdir-convention` change (dependency) consolidates all book artifacts inside `.epubdir/`, making it straightforward to store pre-parsed book structure alongside content.

This design covers the full pipeline: pre-parsing book structure at upload time, HTML transformation in the service worker, and a lightweight client-side viewer script.

## Goals / Non-Goals

**Goals:**
- Inject reading-friendly CSS and a viewer script into EPUB HTML pages via the service worker
- Sanitize EPUB pages by removing publisher scripts and styles (security, consistency)
- Pre-parse book structure (spine order, TOC tree, sidebar HTML) at upload time, stored inside `.epubdir/`
- Provide responsive two-column layout: sidebar (TOC navigation) + content
- Set proper page metadata (`<title>`, `og:title`) dynamically from TOC data
- Support both EPUB 2 (NCX) and EPUB 3 (NAV) for TOC parsing
- Use compositional strategy pattern for HTML rewriting so individual transforms are independently testable and replaceable
- Build `epub-viewer.ts` as a separate Vite entry point, output as a plain JS bundle to `public/epub-assets/`

**Non-Goals:**
- React-based sidebar (sidebar is pure HTML/CSS, injected by the viewer script)
- Persistent reading state across chapter navigation (full page reload per chapter)
- Bookmarks, annotations, search, or reading position tracking
- Theme/font-size customization UI (static CSS with custom properties, no settings panel)
- EPUB page-level headings or footers (prev/next navigation buttons deferred)

## Decisions

### Decision 1: HTML transformation uses `worker-tools/html-rewriter` with a strategy pattern

`html-rewriter` (lol-html WASM) is used inside the service worker. A thin `HtmlRewritePipeline` wrapper exposes a `on(selector, handlers)` API to strategies. Strategies implement `HtmlTransformStrategy`:

```typescript
interface HtmlTransformStrategy {
  name: string
  shouldApply(ctx: EpubPageContext): boolean
  apply(html: HtmlTransformHandle, ctx: EpubPageContext): void
}
```

The pipeline composes strategies in order: Sanitize → InjectStyles → InjectViewer. Each strategy is independently testable (mock the handle).

**Rationale**: `html-rewriter` is the standard for this (used by Cloudflare Workers). The WASM footprint is acceptable in a service worker. The strategy pattern allows adding future transforms (e.g., annotation injection, footnotes) without modifying the pipeline.

**Alternatives considered**:
- Regex-based string replacement: Fragile, breaks on edge cases. Rejected.
- `DOMParser` + `querySelector` in SW: SW DOM API varies, and parsing + serializing loses formatting. Rejected.
- Custom streaming parser: Overkill. `html-rewriter` is purpose-built.

### Decision 2: SanitizeStrategy removes ALL scripts and styles, no exceptions

Publisher scripts and inline styles are completely stripped. After sanitization, the injector strategies add ONLY the viewer's CSS and JS.

**Rationale**: Simple, secure, consistent. No need for allowlists — publisher JS can interfere with the viewer, and publisher CSS can clash with the viewer's layout.

### Decision 3: Viewer script resolves sidebar URLs at injection time (NO `<base>`)

The viewer script computes the `.epubdir/` base URL from `location.href`, fetches `sidebar.html`, and **rewrites all `<a href>` attributes to absolute URLs** by prepending the base URL before injecting into the DOM. Asset fetches (`book.json`, `toc.json`) use the base URL explicitly via `new URL(..., baseUrl)`.

**No `<base>` element is set.** This avoids breaking publisher-internal relative URLs: `<img src="images/foo.png">` in `OEBPS/ch01.xhtml` must resolve relative to `ch01.xhtml`'s directory (`OEBPS/`), not the epubdir root.

**Rationale**: `<base>` applies globally — it would cause `OEBPS/ch01.xhtml`'s images, stylesheets, and other relative references to resolve against the epubdir root instead of the chapter's own directory. Rewriting sidebar links at injection time is a targeted fix that preserves all other relative URL behavior. Using absolute URLs in `<a href>` also preserves native link behaviors (middle-click, Ctrl+click, open in new tab).

### Decision 4: Book structure parsing at upload time using DOMParser + TreeWalker

`parseBookStructure(entries, metadata)` is called during `AddEpubsExtracted`:

- **Spine**: `querySelectorAll("itemref")` on the OPF document (flat list, querySelector is ideal)
- **TOC (EPUB3 NAV)**: `querySelector('nav[epub\\:type="toc"] ol')` on the NAV document (the `<ol>` is flat per nesting level)
- **TOC (EPUB2 NCX)**: `TreeWalker` over `navMap > navPoint` (recursive, TreeWalker is ideal)
- **Sidebar HTML**: Walk the parsed TOC tree and emit `<nav class="ex-toc"><ol><li><a>` with `<details>` for collapsible sections

**Rationale**: Use the right tool for each format — `querySelectorAll` for flat/attribute-based structures, `TreeWalker` for recursive text-content-heavy traversal. Parsing once at upload means the viewer script does zero XML parsing.

### Decision 5: `epub-viewer.ts` as a separate Vite entry point

Configured as a library entry in `vite.config.ts`:

```typescript
build: {
  rollupOptions: {
    input: {
      main: 'index.html',
      'epub-viewer': 'src/viewer/epub-viewer.ts',
    }
  }
}
```

Output goes to `dist/epub-assets/epub-viewer.js`, which is then served by the SW via the existing precache or by copying to `public/epub-assets/`. Uses `type="module"` in the injected `<script>` tag.

**Rationale**: Full TypeScript support, imports for shared utilities, tree-shaking, and minification. The script only needs `fetch`, `DOMParser`, and DOM APIs — no heavy libraries.

### Decision 6: Viewer script injection point — before `</body>`

The SW's `InjectViewerStrategy` appends `<script type="module" src="/epub-assets/epub-viewer.js"></script>` before `</body>`. Using `type="module"` means it executes after the DOM is parsed (deferred by default), which is exactly what we want.

### Decision 7: pageName derivation priority

1. **TOC match**: Walk `toc.json`, find node whose `href` matches the current page. Most reliable — matches reader's mental model.
2. **First `<h1>`**: `document.querySelector('h1')?.textContent` if TOC doesn't resolve.
3. **Existing `<title>`**: Strip book name if separated by `:` or `-`.
4. **Filename humanization**: `ch03.xhtml` → `"Chapter 03"`.

### Decision 8: `sidebar.html` stores path-relative links; viewer script resolves to absolute

All `<a href>` in generated `sidebar.html` use path-relative URLs like `OEBPS/ch02.xhtml` (not absolute `/@epubs/.../OEBPS/ch02.xhtml`). This makes `sidebar.html` portable — it doesn't embed domain or collection path information. At injection time, the viewer script computes the epubdir base URL and rewrites all `<a href>` to absolute URLs (Decision 3), so they work as normal links.

## Risks / Trade-offs

- **[Risk] html-rewriter WASM may choke on XHTML**: EPUB2 XHTML with `<?xml version="1.0"?>` preamble or self-closing `<br/>` tags may confuse the HTML5 parser. Mitigation: Write vitest tests for these cases before implementing. If it fails, the SanitizeStrategy can strip the XML preamble first.
- **[Risk] Circular dependency**: The refactor-epubdir-convention change must be applied before this one (the parser writes into `.epubdir/`). The tasks.md should note this.
- **[Risk] Viewer script size**: If `epub-viewer.ts` grows beyond a minimal script, it slows down every chapter load. Mitigation: Keep it focused — no heavy libraries, no React. Tree-shake aggressively.
- **[Trade-off] Full page reload per chapter**: Using `<a href>` links in the sidebar means each chapter navigation is a full browser navigation. This is simple and robust but loses scroll position. Mitigation: Pre-parsed data + SW caching makes each load near-instant. Scroll position restoration can be added later.
- **[Trade-off] Sidebar is HTML fragment, not interactive component**: Using `innerHTML` with pre-rendered `sidebar.html` means no client-side TOC filtering, no animated expand/collapse (beyond `<details>`), no keyboard shortcuts. Mitigation: This is MVP. The `toc.json` file exists for a future React shell with full interactivity.