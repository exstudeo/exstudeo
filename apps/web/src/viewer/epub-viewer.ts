/**
 * EPUB Viewer — client-side script injected into EPUB pages.
 *
 * This script is built as a separate Vite entry point (not part of the
 * React app). It runs in the context of a standalone EPUB HTML page
 * served by the service worker at `/@epubs/...`.
 *
 * ## Responsibilities
 *
 * 0. Sanitize the page — remove publisher scripts, styles, event handlers
 *    (the SW only injects viewer assets; actual sanitization happens here
 *    using DOMParser which is available in the page context).
 * 1. Compute the epubdir base URL from `location.href`
 * 2. Fetch `sidebar.html`, rewrite relative links to absolute, inject into DOM
 * 3. Fetch `book.json` and `toc.json` to set page title and og:title
 * 4. Highlight the current chapter in the sidebar
 * 5. Provide a mobile sidebar toggle button
 *
 * ## Error handling
 *
 * All operations are guarded with try/catch. Missing `sidebar.html`,
 * `book.json`, or `toc.json` result in graceful fallbacks (empty
 * sidebar, filename-based title) rather than errors.
 *
 * @module epub-viewer
 */

// ═══════════════════════════════════════════════════════════════════════
// 0. Client-Side Sanitization (replaces SW-side SanitizeStrategy)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Remove publisher scripts, styles, inline event handlers, and inline
 * styles from the page.
 *
 * The SW only injects viewer CSS/JS links; actual content sanitization
 * happens here using `DOMParser` which is available in the page context
 * (but not in the classic-script service worker).
 *
 * Runs before any other viewer initialization to prevent publisher
 * scripts from executing.
 */
function sanitizePage(): void {
  // Remove all <script> elements
  for (const el of document.querySelectorAll("script")) {
    el.remove()
  }

  // Remove all <style> elements
  for (const el of document.querySelectorAll("style")) {
    el.remove()
  }

  // Strip inline styles and event handlers from all elements
  const eventAttrPrefix = "on"
  for (const el of document.querySelectorAll("*")) {
    el.removeAttribute("style")
    for (const attr of [...el.attributes]) {
      if (attr.name.toLowerCase().startsWith(eventAttrPrefix)) {
        el.removeAttribute(attr.name)
      }
    }
  }

  // Strip href from publisher <link rel="stylesheet"> elements
  // (skip the viewer's own stylesheet link)
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]',
  )) {
    if (link.href.includes("/epub-assets/epub-style.css")) continue
    link.removeAttribute("href")
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 7.1 URL Parsing — Extract epubdir Base URL
// ═══════════════════════════════════════════════════════════════════════

/**
 * Extract the `.epubdir/` base URL from the current page's location.
 *
 * Scans `location.href` for the last `.epubdir` segment and returns
 * everything up to and including that segment followed by a `/`.
 *
 * @returns The epubdir base URL with trailing slash, or `null` if not
 *          found (page is not inside an epubdir).
 *
 * @example
 * ```ts
 * // location.href = "https://example.com/@epubs/col/book.epubdir/OEBPS/ch01.xhtml"
 * getEpubdirBaseUrl() // "https://example.com/@epubs/col/book.epubdir/"
 * ```
 */
function getEpubdirBaseUrl(): string | null {
  const href = location.href
  const epubdirIdx = href.lastIndexOf(".epubdir")

  if (epubdirIdx === -1) {
    console.warn(
      "[EpubViewer] No .epubdir segment found in URL. " +
        "Sidebar links will not be rewritten.",
    )
    return null
  }

  // Include ".epubdir/" — everything up to and including the trailing slash
  const endIdx = epubdirIdx + ".epubdir".length
  return href.slice(0, endIdx) + "/"
}

// ═══════════════════════════════════════════════════════════════════════
// 7.2 Sidebar Link Rewriting
// ═══════════════════════════════════════════════════════════════════════

/**
 * Rewrite all `<a href>` attributes in a sidebar HTML document to
 * absolute URLs.
 *
 * Relative hrefs are resolved against the `epubdirBaseUrl`. Already-
 * absolute URLs (http://, https://) and fragment-only links (#) are
 * left untouched.
 *
 * Uses the URL constructor with `epubdirBaseUrl` as the base, which
 * correctly handles path-relative (`../`) and `./` links.
 *
 * @param sidebarDoc  Parsed sidebar HTML document.
 * @param baseUrl     The epubdir base URL (with trailing slash).
 */
function rewriteSidebarLinks(
  sidebarDoc: Document,
  baseUrl: string,
): void {
  const anchors = sidebarDoc.querySelectorAll<HTMLAnchorElement>("a[href]")

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href")
    if (!href) continue

    // Skip already-absolute URLs
    if (/^(https?:)?\/\//i.test(href)) continue

    // Skip fragment-only links
    if (href.startsWith("#")) continue

    try {
      // Resolve relative href against the epubdir base URL
      const absolute = new URL(href, baseUrl)
      anchor.setAttribute("href", absolute.href)
    } catch {
      // If URL construction fails (malformed href), leave as-is
      console.warn(
        `[EpubViewer] Failed to resolve sidebar link href: "${href}"`,
      )
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 7.3–7.4 Page Title Resolution
// ═══════════════════════════════════════════════════════════════════════

/**
 * Resolve the page name using the priority chain:
 * 1. TOC label matching the current href
 * 2. Text content of the first `<h1>` element
 * 3. Text content of the existing `<title>` with book name stripped
 * 4. Humanized filename from the URL
 *
 * @param toc       Parsed TOC JSON (array of TocNode).
 * @param pageHref  The current page href relative to the epubdir root.
 * @returns The resolved page name.
 */
function resolvePageName(toc: TocNode[], pageHref: string): string {
  // Priority 1: TOC match
  const tocMatch = findTocMatch(toc, pageHref)
  if (tocMatch) return tocMatch

  // Priority 2: First <h1>
  const h1 = document.querySelector("h1")
  if (h1?.textContent) {
    return h1.textContent.trim()
  }

  // Priority 3: Existing <title> (strip book name if possible)
  const existingTitle = document.querySelector("title")?.textContent?.trim()
  if (existingTitle) {
    // Try to strip "BookName: " or "BookName - " prefix
    const cleaned = existingTitle.replace(/^[^:]+:\s*/, "").trim()
    if (cleaned) return cleaned
    return existingTitle
  }

  // Priority 4: Humanized filename
  return humanizeFilename(pageHref)
}

/**
 * Recursively search the TOC tree for a node whose href matches the
 * current page href.
 *
 * @param toc       TOC tree to search.
 * @param pageHref  The current page href.
 * @returns The matching label, or null.
 */
function findTocMatch(toc: TocNode[], pageHref: string): string | null {
  for (const node of toc) {
    if (node.href === pageHref) return node.label
    if (node.children) {
      const found = findTocMatch(node.children, pageHref)
      if (found) return found
    }
  }
  return null
}

/**
 * Humanize a filename for display as a page title.
 *
 * Strips the file extension, replaces hyphens/underscores with spaces,
 * and capitalizes each word.
 *
 * @param href  A file path like `"OEBPS/ch03.xhtml"`.
 * @returns A humanized title like `"Chapter 03"`.
 */
function humanizeFilename(href: string): string {
  const filename = href.split("/").pop() ?? href
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "")
  return nameWithoutExt
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Set `document.title` and update/create the `og:title` meta tag.
 *
 * @param bookName  The book name from `book.json`.
 * @param pageName  The resolved page name.
 */
function setPageTitle(bookName: string, pageName: string): void {
  const title = pageName ? `${bookName}: ${pageName}` : bookName
  document.title = title

  // Update or create og:title meta tag
  let ogTitle = document.querySelector<HTMLMetaElement>(
    'meta[property="og:title"]',
  )
  if (!ogTitle) {
    ogTitle = document.createElement("meta")
    ogTitle.setAttribute("property", "og:title")
    document.head.appendChild(ogTitle)
  }
  ogTitle.setAttribute("content", title)
}

// ═══════════════════════════════════════════════════════════════════════
// 7.5 Sidebar Injection
// ═══════════════════════════════════════════════════════════════════════

/**
 * Inject the sidebar HTML into the page and wrap the original body
 * content in `<main class="ex-content">`.
 *
 * Creates the structure:
 * ```html
 * <body>
 *   <nav class="ex-sidebar">...</nav>
 *   <button class="ex-sidebar-toggle">☰</button>
 *   <div class="ex-sidebar-overlay"></div>
 *   <main class="ex-content"><!-- original body content --></main>
 * </body>
 * ```
 *
 * @param sidebarHtml  Pre-fetched and link-rewritten sidebar HTML string.
 * @param baseUrl      The epubdir base URL (used for link rewriting).
 */
function injectSidebar(sidebarHtml: string): void {
  // Parse the sidebar HTML fragment
  const parser = new DOMParser()
  const sidebarDoc = parser.parseFromString(sidebarHtml, "text/html")

  // Rewrite links if we have a base URL
  const baseUrl = getEpubdirBaseUrl()
  if (baseUrl) {
    rewriteSidebarLinks(sidebarDoc, baseUrl)
  }

  // Create sidebar container
  const sidebarNav = document.createElement("nav")
  sidebarNav.className = "ex-sidebar"

  // Move sidebar body content into the nav (skip <html><head><body> wrapper)
  const sidebarBody = sidebarDoc.body
  while (sidebarBody.firstChild) {
    sidebarNav.appendChild(sidebarBody.firstChild)
  }

  // Create hamburger toggle button
  const toggleBtn = document.createElement("button")
  toggleBtn.className = "ex-sidebar-toggle"
  toggleBtn.setAttribute("aria-label", "Toggle sidebar")
  toggleBtn.textContent = "☰"

  // Create overlay for mobile
  const overlay = document.createElement("div")
  overlay.className = "ex-sidebar-overlay"

  // Collect original body children
  const originalChildren = Array.from(document.body.childNodes)

  // Wrap original content in <main class="ex-content">
  const main = document.createElement("main")
  main.className = "ex-content"
  for (const child of originalChildren) {
    main.appendChild(child)
  }

  // Reconstruct body
  document.body.appendChild(sidebarNav)
  document.body.appendChild(toggleBtn)
  document.body.appendChild(overlay)
  document.body.appendChild(main)
}

// ═══════════════════════════════════════════════════════════════════════
// 7.6 Current Chapter Highlighting
// ═══════════════════════════════════════════════════════════════════════

/**
 * Add the `ex-current` class to sidebar links whose href matches the
 * current page URL, then scroll the matching link into view so the
 * sidebar TOC tracks the reader's position.
 *
 * Compares the `href` property (which is always the resolved absolute
 * URL) against `location.href`.
 */
function highlightCurrentChapter(): void {
  const currentHref = location.href
  const anchors =
    document.querySelectorAll<HTMLAnchorElement>(".ex-sidebar a[href]")

  let found: HTMLAnchorElement | null = null

  for (const anchor of anchors) {
    if (anchor.href === currentHref) {
      anchor.classList.add("ex-current")
      found = anchor
      break
    }
  }

  // Scroll the current TOC entry to the center of the sidebar viewport.
  if (found) {
    found.scrollIntoView({ block: "center", behavior: "instant" })
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 7.7 Mobile Sidebar Toggle
// ═══════════════════════════════════════════════════════════════════════

/**
 * Wire up the mobile sidebar toggle button.
 *
 * On mobile (<768px), clicking the hamburger button opens the sidebar
 * as a slide-in drawer with an overlay. Clicking the overlay or
 * pressing Escape closes it.
 */
function wireSidebarToggle(): void {
  const toggleBtn = document.querySelector<HTMLButtonElement>(".ex-sidebar-toggle")
  const sidebar = document.querySelector<HTMLElement>(".ex-sidebar")
  const overlay = document.querySelector<HTMLElement>(".ex-sidebar-overlay")

  if (!toggleBtn || !sidebar || !overlay) return

  /**
   * Open the sidebar drawer.
   */
  function openSidebar(): void {
    sidebar!.classList.add("open")
    overlay!.classList.add("open")
    toggleBtn!.setAttribute("aria-expanded", "true")
  }

  /**
   * Close the sidebar drawer.
   */
  function closeSidebar(): void {
    sidebar!.classList.remove("open")
    overlay!.classList.remove("open")
    toggleBtn!.setAttribute("aria-expanded", "false")
  }

  toggleBtn.addEventListener("click", () => {
    if (sidebar.classList.contains("open")) {
      closeSidebar()
    } else {
      openSidebar()
    }
  })

  overlay.addEventListener("click", closeSidebar)

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) {
      closeSidebar()
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════
// Types used by the viewer
// ═══════════════════════════════════════════════════════════════════════

/** A TOC node as stored in toc.json. */
interface TocNode {
  label: string
  href: string
  children?: TocNode[]
}

/** Book metadata as stored in book.json. */
interface BookJson {
  title?: string
  uniqueIdentifier: string
}

// ═══════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════

/**
 * Initialize the EPUB viewer.
 *
 * 1. Fetch sidebar.html, inject into DOM
 * 2. Fetch book.json and toc.json
 * 3. Resolve and set page title
 * 4. Highlight current chapter
 * 5. Wire mobile toggle
 *
 * All errors are caught and logged; the viewer degrades gracefully.
 */
async function main(): Promise<void> {
  // ── Step 0: Sanitize publisher content ────────────────────────────
  // Must run first to prevent publisher scripts from executing.
  sanitizePage()

  const baseUrl = getEpubdirBaseUrl()

  console.log(
    "[EpubViewer] Initializing for",
    baseUrl ? `epubdir: ${baseUrl}` : "unknown epubdir",
  )

  // ── Step 1: Fetch and inject sidebar ──────────────────────────────

  let sidebarHtml = ""

  if (baseUrl) {
    try {
      const sidebarUrl = new URL("./sidebar.html", baseUrl)
      const response = await fetch(sidebarUrl)
      if (response.ok) {
        sidebarHtml = await response.text()
      } else {
        console.warn(
          `[EpubViewer] sidebar.html fetch failed (${response.status}). ` +
            "Using empty sidebar.",
        )
      }
    } catch (err) {
      console.warn("[EpubViewer] Failed to fetch sidebar.html:", err)
    }
  }

  // Always inject sidebar (empty if fetch failed)
  injectSidebar(sidebarHtml || "<nav></nav>")

  // ── Step 2: Fetch book.json ───────────────────────────────────────

  let bookName = ""

  if (baseUrl) {
    try {
      const bookUrl = new URL("./book.json", baseUrl)
      const response = await fetch(bookUrl)
      if (response.ok) {
        const bookJson: BookJson = await response.json()
        bookName = bookJson.title ?? bookJson.uniqueIdentifier
      } else {
        console.warn(
          `[EpubViewer] book.json fetch failed (${response.status}). ` +
            "Title will fall back to filename.",
        )
      }
    } catch (err) {
      console.warn("[EpubViewer] Failed to fetch book.json:", err)
    }
  }

  // ── Step 3: Fetch toc.json & resolve page title ───────────────────

  if (baseUrl && bookName) {
    try {
      const tocUrl = new URL("./toc.json", baseUrl)
      const response = await fetch(tocUrl)
      if (response.ok) {
        const toc: TocNode[] = await response.json()
        // Determine the current page href relative to epubdir
        const pageHref = location.href.slice(baseUrl.length)
        const pageName = resolvePageName(toc, pageHref)
        setPageTitle(bookName, pageName)
      } else {
        // No TOC — fall back to h1/filename
        const pageHref = location.href.slice(baseUrl.length)
        const pageName = resolvePageName([], pageHref)
        setPageTitle(bookName, pageName)
      }
    } catch (err) {
      console.warn("[EpubViewer] Failed to fetch toc.json:", err)
      // Fallback without TOC
      const pageHref = location.href.slice(baseUrl.length)
      const pageName = resolvePageName([], pageHref)
      setPageTitle(bookName, pageName)
    }
  } else if (!bookName) {
    // No baseUrl — use document's existing title or filename from URL
    const filename = humanizeFilename(location.pathname)
    setPageTitle(filename, "")
  }

  // ── Step 4: Highlight current chapter ─────────────────────────────

  highlightCurrentChapter()

  // ── Step 5: Wire mobile toggle ────────────────────────────────────

  wireSidebarToggle()

  console.log("[EpubViewer] Initialization complete.")
}

main().catch((err: unknown) => {
  console.error("[EpubViewer] Initialization failed:", err)
})