## Why

Currently, navigating to an EPUB chapter URL (`/@epubs/.../ch01.xhtml`) renders raw publisher HTML — no reading-friendly typography, no table of contents sidebar, no chapter navigation, and page metadata (`<title>`) is whatever the publisher embedded. This change implements a complete EPUB reading experience by injecting viewer CSS and JavaScript via the service worker, pre-parsing book structure at upload time, and providing a responsive sidebar navigation built with pure HTML/CSS.

## What Changes

- **New**: HTML rewrite pipeline in the service worker — a compositional strategy pattern (`SanitizeStrategy`, `InjectStylesStrategy`, `InjectViewerStrategy`) that transforms EPUB HTML pages before serving them
- **New**: `epub-style.css` — responsive reading layout with CSS grid sidebar + content, typography reset, dark mode support via custom properties
- **New**: `epub-viewer.ts` — lightweight client-side script (separate Vite entry point) that computes the epubdir base URL, fetches and injects sidebar HTML (rewriting links to absolute URLs), sets page metadata (`<title>`, `og:title`), and highlights the current chapter
- **New**: Book structure pre-parsing at upload time — generates `spine.json`, `toc.json`, and `sidebar.html` from the EPUB's OPF/NCX/NAV documents using both `querySelector` (for flat structures) and `TreeWalker` (for recursive NCX navigation points)
- **New**: Dependency on `worker-tools/html-rewriter` (lol-html WASM) for HTML transformation in the service worker
- **Modified**: EPUB upload pipeline (`epubzip.ts` + `view-model.ts`) now calls `parseBookStructure()` to generate per-book metadata files
- **Modified**: SW EPUB route (`epub.ts`) now runs the HTML rewrite pipeline for `.xhtml`/`.html` responses before serving

## Capabilities

### New Capabilities
- **html-rewrite-pipeline**: Compositional HTML transformation strategies in the service worker for EPUB content pages
- **epub-viewer**: Client-side viewer script and responsive reading stylesheet with sidebar TOC navigation
- **epub-book-parsing**: Pre-parsing EPUB structure at upload time — spine order, table of contents tree, and pre-rendered sidebar HTML

### Modified Capabilities
- **epub-explorer**: The EPUB upload pipeline now generates `spine.json`, `toc.json`, and `sidebar.html` inside the `.epubdir/` directory during `AddEpubsExtracted`
- **sw-route-epub**: The EPUB route handler now executes the HTML rewrite pipeline for HTML/XHTML responses, injecting viewer CSS and JS and sanitizing publisher scripts/styles

## Impact

- New files: `src/sw-routes/html-rewrite/` (pipeline + strategies), `src/viewer/` (Vite entry for epub-viewer.ts), `src/lib/epub-lib/book-parser.ts` (NCX/NAV/spine parsing), `public/epub-assets/epub-style.css` (filled in)
- New dependency: `worker-tools/html-rewriter` (npm package)
- Modified files: `src/sw-routes/epub.ts` (adds pipeline invocation), `src/lib/epub-lib/view-model.ts` (calls parser during upload), `src/lib/epub-lib/epubzip.ts` (may export helper for OPF access during parsing), Vite config (multi-entry build for viewer script)
- Modified specs: `epub-explorer` (upload pipeline), `sw-route-epub` (HTML rewriting)
- The viewer script (`epub-viewer.ts`) uses a separate Vite entry point, outputting to `public/epub-assets/epub-viewer.js`