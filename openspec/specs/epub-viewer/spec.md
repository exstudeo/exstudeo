# EPUB Viewer

## Purpose

TBD — Client-side viewer script and stylesheet that provides a reading UI (sidebar navigation, reading typography, responsive layout) for EPUB content pages served through the service worker.

## Requirements

### Requirement: Viewer computes epubdir base URL and rewrites sidebar links

The `epub-viewer.ts` script SHALL, on initialization, extract the `.epubdir/` directory prefix from `location.href` and store it as the `epubdirBaseUrl` (with trailing slash). After fetching `sidebar.html`, it SHALL rewrite all `<a href>` attributes to absolute URLs by prepending the `epubdirBaseUrl`. Viewport-relative URLs SHALL NOT be modified. The script SHALL NOT set a `<base>` element, preserving publisher-internal relative URLs (images, fonts, stylesheets) resolution relative to the chapter's own directory.

**Rationale**: A `<base>` element would globally redirect all relative URLs to the epubdir root, breaking publisher resources like `<img src="images/foo.png">` in `OEBPS/ch01.xhtml` (which must resolve to `OEBPS/images/foo.png`, not `images/foo.png`). Rewriting only the sidebar links is the targeted, safe solution.

#### Scenario: Epubdir base URL computed from standard path
- **WHEN** `location.href` is `https://example.com/@epubs/sci-fi/bookId.epubdir/OEBPS/ch01.xhtml`
- **THEN** `epubdirBaseUrl` is `https://example.com/@epubs/sci-fi/bookId.epubdir/`

#### Scenario: Epubdir base URL computed from nested collection path
- **WHEN** `location.href` is `https://example.com/@epubs/a/b/bookId.epubdir/OEBPS/ch01.xhtml`
- **THEN** `epubdirBaseUrl` is `https://example.com/@epubs/a/b/bookId.epubdir/`

#### Scenario: Sidebar links rewritten to absolute URLs
- **WHEN** `sidebar.html` contains `<a href="OEBPS/ch02.xhtml">Chapter 2</a>` and `epubdirBaseUrl` is `https://example.com/@epubs/book.epubdir/`
- **THEN** the injected DOM has `<a href="https://example.com/@epubs/book.epubdir/OEBPS/ch02.xhtml">Chapter 2</a>`

#### Scenario: Path-relative links containing `../` resolved correctly
- **WHEN** `sidebar.html` contains `<a href="../OEBPS/ch02.xhtml">`
- **THEN** it is resolved against the epubdir base URL (e.g., `https://example.com/@epubs/book.epubdir/OEBPS/ch02.xhtml`)

#### Scenario: Already-absolute links left untouched
- **WHEN** `sidebar.html` contains `<a href="https://external.com/page">`
- **THEN** the href is not modified

#### Scenario: Fragment-only links left untouched
- **WHEN** `sidebar.html` contains `<a href="#section-1">`
- **THEN** the href is not modified

#### Scenario: No `.epubdir` segment handled gracefully
- **WHEN** `location.href` does not contain `.epubdir`
- **THEN** `epubdirBaseUrl` is set to `null`, sidebar links are NOT rewritten (left as-is), and a warning is logged

#### Scenario: Asset fetches use epubdir base URL
- **WHEN** the viewer fetches `book.json` or `toc.json`
- **THEN** the URL is constructed as `new URL('./book.json', epubdirBaseUrl)`

### Requirement: Viewer sets document.title from TOC

The `epub-viewer.ts` script SHALL fetch `./book.json` to obtain the book name, fetch `./toc.json` to find the page name for the current document's href, and set `document.title` to `"${bookName}: ${pageName}"`. The pageName SHALL be resolved by the following priority: (1) TOC label matching the current href, (2) text content of the first `<h1>` element, (3) text content of the existing `<title>` with book name stripped, (4) humanized filename from the URL.

#### Scenario: Title set from TOC match
- **WHEN** the current page href is `OEBPS/ch02.xhtml` and `toc.json` contains `{ label: "Chapter 2: The Journey", href: "OEBPS/ch02.xhtml" }`
- **THEN** `document.title` is set to `"My Book: Chapter 2: The Journey"`

#### Scenario: Title falls back to h1
- **WHEN** no TOC entry matches the current href but the page has `<h1>CHAPTER TWO</h1>`
- **THEN** `document.title` is set to `"My Book: CHAPTER TWO"`

#### Scenario: Title falls back to existing title
- **WHEN** no TOC entry matches and no h1 exists, but the page has `<title>My Book - Part 2</title>`
- **THEN** `document.title` is set to `"My Book: Part 2"`

#### Scenario: Title falls back to filename
- **WHEN** no TOC match, no h1, no existing title
- **THEN** the filename `ch03.xhtml` is humanized to `"Chapter 03"` and `document.title` is set to `"My Book: Chapter 03"`

### Requirement: Viewer sets og:title meta tag

The `epub-viewer.ts` script SHALL set or create an `<meta property="og:title">` tag with the same value as `document.title`.

#### Scenario: og:title updated when title changes
- **WHEN** `document.title` is set to `"My Book: Chapter 1"`
- **THEN** a `<meta property="og:title" content="My Book: Chapter 1">` element exists in `<head>`

#### Scenario: Existing og:title updated rather than duplicated
- **WHEN** `<meta property="og:title" content="Old Title">` already exists
- **THEN** its `content` attribute is updated to the new title rather than creating a new meta element

### Requirement: Viewer injects sidebar HTML

The `epub-viewer.ts` script SHALL fetch `./sidebar.html`, parse it as an HTML fragment, and inject it into a container element with class `ex-sidebar` that is prepended to `<body>`. The original EPUB body content SHALL be wrapped in a `<main class="ex-content">` element.

#### Scenario: Sidebar injected with content wrapper
- **WHEN** the viewer script runs on a page with `<body><h1>Chapter 1</h1><p>Text</p></body>`
- **THEN** `<body>` contains `<nav class="ex-sidebar">` (with sidebar.html content) followed by `<main class="ex-content">` (with original body contents)

#### Scenario: Sidebar fetch failure handled gracefully
- **WHEN** `./sidebar.html` fetch fails (404 or network error)
- **THEN** the viewer script logs a warning, creates an empty `<nav class="ex-sidebar">`, and continues with content wrapping

### Requirement: Viewer highlights current chapter in sidebar

The `epub-viewer.ts` script SHALL add a class `ex-current` to the sidebar `<a>` element whose `href` (after rewriting) matches `location.href`.

#### Scenario: Current chapter highlighted
- **WHEN** `location.href` is `https://example.com/@epubs/book.epubdir/OEBPS/ch02.xhtml` and the injected sidebar contains `<a href="https://example.com/@epubs/book.epubdir/OEBPS/ch02.xhtml">Chapter 2</a>`
- **THEN** that anchor element receives the class `ex-current`

#### Scenario: Multiple matches highlight all
- **WHEN** two sidebar links point to the same href (unusual but possible)
- **THEN** both receive the class `ex-current`

### Requirement: Viewer CSS defines responsive two-column layout

The `epub-style.css` stylesheet SHALL define a CSS grid layout: sidebar (`.ex-sidebar`) on the left at 280px width, content (`.ex-content`) filling remaining space. On viewports narrower than 768px, the layout SHALL stack vertically and the sidebar SHALL become a fixed-position slide-in drawer triggered by a toggle.

#### Scenario: Desktop layout shows sidebar and content side by side
- **WHEN** the viewport is 1024px wide
- **THEN** `.ex-sidebar` is visible at approximately 280px on the left
- **AND** `.ex-content` fills the remaining space

#### Scenario: Mobile layout stacks vertically
- **WHEN** the viewport is 600px wide
- **THEN** `.ex-sidebar` is hidden off-screen (transform: translateX(-100%))
- **AND** `.ex-content` fills the full width

### Requirement: Viewer CSS defines reading typography

The `epub-style.css` stylesheet SHALL set reading-optimized typography on `.ex-content`: a serif font stack, comfortable line height (1.6–1.8), max-width of 65ch, centered with auto margins, and font-size scaled for readability (default 16px). It SHALL define CSS custom properties (`--ex-bg`, `--ex-fg`, `--ex-border`, `--ex-sidebar-bg`, etc.) for theming.

#### Scenario: Content has reading-optimized typography
- **WHEN** an EPUB page loads with the injected stylesheet
- **THEN** the content area has `max-width: 65ch`, `margin: 0 auto`, and `line-height` of at least 1.6

### Requirement: Viewer CSS supports dark mode

The `epub-style.css` stylesheet SHALL define dark mode overrides using `@media (prefers-color-scheme: dark)` that reassign the CSS custom properties to dark-appropriate values.

#### Scenario: Dark mode colors applied
- **WHEN** the user's OS is in dark mode
- **THEN** `--ex-bg` is a dark color and `--ex-fg` is a light color
- **AND** the sidebar and content areas render with dark backgrounds