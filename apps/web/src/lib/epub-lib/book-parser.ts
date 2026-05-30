/**
 * EPUB Book Structure Parser.
 *
 * Parses the OPF, NCX, and NAV documents from an unzipped EPUB to
 * extract spine order, table of contents tree, and generates a
 * pre-rendered sidebar HTML fragment.
 *
 * Called at upload time during `AddEpubsExtracted` in the ViewModel.
 *
 * ## Parsing strategy
 *
 * - **Spine**: `querySelectorAll("itemref")` on the OPF document
 * - **TOC (EPUB 3 NAV)**: `querySelector("nav[epub\\:type=\"toc\"] ol")`
 * - **TOC (EPUB 2 NCX)**: `TreeWalker` over `navMap > navPoint`
 * - **Sidebar HTML**: Walk the parsed TOC tree, emit `<nav class="ex-toc">`
 *
 * @module book-parser
 */

import type { IEpub } from "./type"

// ── Types ─────────────────────────────────────────────────────────────────

/** A single item in the EPUB spine reading order. */
export interface SpineItem {
  /** The `id` attribute of the itemref. */
  id: string
  /** The `idref` attribute referencing the manifest item. */
  idref: string
  /** Whether this item is linear (defaults to true). */
  linear: boolean
  /** The resolved href from the manifest item. */
  href: string
}

/** A node in the table of contents tree. */
export interface TocNode {
  /** Display label for this TOC entry. */
  label: string
  /** Resolved href relative to the epubdir root. */
  href: string
  /** Child TOC entries (for nested subsections). */
  children?: TocNode[]
}

/** The complete parsed book structure. */
export interface BookStructure {
  /** Ordered spine items. */
  spine: SpineItem[]
  /** Table of contents tree (root-level entries). */
  toc: TocNode[]
  /** Pre-rendered sidebar HTML fragment. */
  sidebarHtml: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Decode an ArrayBuffer to a string using UTF-8.
 *
 * EPUB metadata files (OPF, NCX, NAV) are always UTF-8 or ASCII.
 */
function decodeBuffer(buf: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buf)
}

/**
 * Parse an XML string into a Document using DOMParser.
 *
 * Uses `application/xml` MIME type for NCX and OPF documents
 * (which are strict XML, not HTML).
 */
function parseXml(xmlStr: string): Document {
  return new DOMParser().parseFromString(xmlStr, "application/xml")
}

/**
 * Parse an HTML string into a Document using DOMParser.
 *
 * Uses `text/html` MIME type for EPUB 3 NAV documents.
 */
function parseHtml(htmlStr: string): Document {
  return new DOMParser().parseFromString(htmlStr, "text/html")
}

/**
 * Compute the directory containing a given file path.
 *
 * @example
 * ```ts
 * dirname("OEBPS/content.opf")    // "OEBPS"
 * dirname("toc.ncx")              // ""
 * dirname("OEBPS/nav.xhtml")      // "OEBPS"
 * ```
 */
function dirname(filePath: string): string {
  const idx = filePath.lastIndexOf("/")
  return idx === -1 ? "" : filePath.slice(0, idx)
}

/**
 * Resolve a relative href against a base directory.
 *
 * @param href      A relative path (e.g., `"ch01.xhtml"` or `"../ch01.xhtml"`).
 * @param baseDir   The directory containing the document that references this href.
 * @returns The resolved path relative to the epubdir root.
 *
 * @example
 * ```ts
 * resolveHref("ch01.xhtml", "OEBPS")            // "OEBPS/ch01.xhtml"
 * resolveHref("../Text/ch01.xhtml", "OEBPS")    // "Text/ch01.xhtml"
 * ```
 */
function resolveHref(href: string, baseDir: string): string {
  if (!baseDir) return href.replace(/^\.\//, "")

  const parts = baseDir.split("/")
  const hrefParts = href.split("/")

  for (const part of hrefParts) {
    if (part === "." || part === "") continue
    if (part === "..") {
      if (parts.length > 0) parts.pop()
    } else {
      parts.push(part)
    }
  }

  return parts.join("/")
}

// ── Spine Parsing (5.2) ───────────────────────────────────────────────────

/**
 * Extract the spine reading order from the OPF document.
 *
 * Queries all `<itemref>` elements within `<spine>`, resolves their
 * `idref` against the manifest to get the actual href.
 *
 * Note: The caller must read the OPF data from `entries` and pass the
 * parsed Document. The `entries` map is used to look up manifest items
 * (though in practice all data comes from the OPF doc itself).
 *
 * @param opfDoc   Parsed OPF (package) document.
 * @param opfDir   Directory containing the OPF file.
 * @returns Array of spine items in reading order.
 */
function parseSpine(opfDoc: Document, opfDir: string): SpineItem[] {
  // Build a manifest lookup: manifest item id → href
  const manifestMap = new Map<string, string>()
  const itemElements = opfDoc.querySelectorAll("manifest > item, manifest > item")
  // Also try namespaced selectors
  const allItems = opfDoc.querySelectorAll("item")
  for (const item of allItems) {
    const itemId = item.getAttribute("id")
    const itemHref = item.getAttribute("href")
    if (itemId && itemHref) {
      manifestMap.set(itemId, itemHref)
    }
  }

  const spineItems: SpineItem[] = []
  const itemrefs = opfDoc.querySelectorAll("spine > itemref, spine > itemref")

  for (const itemref of itemrefs) {
    const id = itemref.getAttribute("id") ?? ""
    const idref = itemref.getAttribute("idref")
    if (!idref) continue

    const linear = itemref.getAttribute("linear") !== "no"
    const manifestHref = manifestMap.get(idref)
    if (!manifestHref) {
      console.warn(`[BookParser] Manifest item "${idref}" not found for spine ref`)
      continue
    }

    const href = resolveHref(manifestHref, opfDir)

    spineItems.push({
      id,
      idref,
      linear,
      href,
    })
  }

  return spineItems
}

// ── EPUB 3 NAV Parsing (5.3) ──────────────────────────────────────────────

/**
 * Recursively walk a `<ol>` element in the NAV document and build a
 * `TocNode` tree.
 *
 * Each `<li>` contains:
 * - An `<a>` element (label + href)
 * - Optionally a nested `<ol>` for subsections
 *
 * @param ol     The `<ol>` element to walk.
 * @param navDir Directory containing the NAV document (for href resolution).
 * @returns Array of TOC nodes.
 */
function walkNavOl(ol: Element, navDir: string): TocNode[] {
  const nodes: TocNode[] = []

  // Iterate over direct <li> children only (not nested <ol> children)
  for (const li of ol.children) {
    if (li.tagName !== "LI") continue

    // Find the <a> element (EPUB 3 nav labels are in <a>)
    const anchor = li.querySelector(":scope > a, :scope > span > a")
    if (!anchor) continue

    const label = (anchor.textContent ?? "").trim()
    const rawHref = anchor.getAttribute("href") ?? ""
    const href = resolveHref(rawHref, navDir)

    const node: TocNode = { label, href }

    // Check for nested <ol> (subsections)
    const nestedOl = li.querySelector(":scope > ol")
    if (nestedOl) {
      node.children = walkNavOl(nestedOl, navDir)
    }

    nodes.push(node)
  }

  return nodes
}

/**
 * Extract the TOC tree from an EPUB 3 Navigation Document.
 *
 * Locates `<nav epub:type="toc">` (case-insensitive attribute matching
 * via querySelector with namespace) and walks its ordered list.
 *
 * @param navDoc  Parsed NAV (X)HTML document.
 * @param navDir  Directory containing the NAV document.
 * @returns Array of root-level TOC nodes.
 */
function parseTocNav(navDoc: Document, navDir: string): TocNode[] {
  // Try the namespace-aware selector first
  let navElement = navDoc.querySelector('nav[epub\\:type="toc"]')

  // Fallback: search all <nav> elements and check getAttribute
  if (!navElement) {
    for (const nav of navDoc.querySelectorAll("nav")) {
      if (nav.getAttribute("epub:type") === "toc") {
        navElement = nav
        break
      }
    }
  }

  if (!navElement) return []

  const ol = navElement.querySelector("ol")
  if (!ol) return []

  return walkNavOl(ol, navDir)
}

// ── EPUB 2 NCX Parsing (5.4) ──────────────────────────────────────────────

/**
 * Recursively walk NCX `navPoint` elements using TreeWalker and build
 * a `TocNode` tree.
 *
 * TreeWalker is ideal for NCX because `navPoint` elements can be deeply
 * nested and we need text-content-aware traversal (navLabel/text).
 *
 * @param rootNavPoint  The root `<navPoint>` element to start from.
 * @param ncxDir        Directory containing the NCX document.
 * @returns Array of root-level TOC nodes.
 */
function walkNcxNavPoints(
  rootNavPoint: Element,
  ncxDir: string,
): TocNode[] {
  const nodes: TocNode[] = []

  // Create a TreeWalker that only visits <navPoint> elements
  const walker = document.createTreeWalker(
    rootNavPoint,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node: Node): number {
        return (node as Element).tagName.toUpperCase() === "NAVPOINT"
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP
      },
    },
  )

  // We need to track depth to build the tree correctly.
  // Strategy: use a stack-based approach.
  const stack: { node: TocNode; depth: number }[] = []
  let currentDepth = 0
  let currentNode: Node | null = walker.firstChild()

  while (currentNode) {
    const navPoint = currentNode as Element
    const depth = getNavPointDepth(navPoint, rootNavPoint)

    // Extract label and href
    const navLabel = navPoint.querySelector("navLabel > text")
    const label = (navLabel?.textContent ?? "").trim()

    const content = navPoint.querySelector("content")
    const rawHref = content?.getAttribute("src") ?? ""
    const href = resolveHref(rawHref, ncxDir)

    const tocNode: TocNode = { label, href }

    // Determine where to place this node based on depth
    if (depth === 1) {
      // Root-level node
      if (stack.length > 0) {
        // Flush any remaining stack to the result
        flushStack(stack, nodes)
      }
      nodes.push(tocNode)
      stack.length = 0
      stack.push({ node: tocNode, depth: 1 })
    } else if (depth > currentDepth) {
      // Going deeper — this is a child of the previous node
      const parent = stack.length > 0 ? stack[stack.length - 1].node : null
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(tocNode)
      } else {
        nodes.push(tocNode)
      }
      stack.push({ node: tocNode, depth })
    } else if (depth === currentDepth) {
      // Same level — sibling
      stack.pop()
      const parent = stack.length > 0 ? stack[stack.length - 1].node : null
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(tocNode)
      } else {
        nodes.push(tocNode)
      }
      stack.push({ node: tocNode, depth })
    } else {
      // Going up — pop until we find the parent at depth-1
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop()
      }
      const parent = stack.length > 0 ? stack[stack.length - 1].node : null
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(tocNode)
      } else {
        nodes.push(tocNode)
      }
      stack.push({ node: tocNode, depth })
    }

    currentDepth = depth
    currentNode = walker.nextNode()
  }

  // Flush remaining stack
  flushStack(stack, nodes)

  return nodes
}

/**
 * Compute the nesting depth of a navPoint relative to the root.
 *
 * Counts ancestor `<navPoint>` elements up to (but not including)
 * the root.
 */
function getNavPointDepth(navPoint: Element, root: Element): number {
  let depth = 0
  let current: Element | null = navPoint
  while (current && current !== root) {
    if (current.tagName.toUpperCase() === "NAVPOINT") {
      depth++
    }
    current = current.parentElement
  }
  return depth
}

/**
 * Flush all nodes from the stack into the result array, adding them
 * as children of their appropriate parents.
 */
function flushStack(
  stack: { node: TocNode; depth: number }[],
  result: TocNode[],
): void {
  // We only need the root-level nodes; the tree structure is already
  // built via children arrays. This is a no-op since we pop from the
  // stack during traversal — the stack entries are intermediate state.
  // We simply ensure any nodes at depth 1 are in result.
  for (const entry of stack) {
    if (entry.depth === 1 && !result.includes(entry.node)) {
      result.push(entry.node)
    }
  }
}

/**
 * Extract the TOC tree from an EPUB 2 NCX document using TreeWalker.
 *
 * Walks `<navMap><navPoint>` elements recursively.
 *
 * @param ncxDoc  Parsed NCX XML document.
 * @param ncxDir  Directory containing the NCX document.
 * @returns Array of root-level TOC nodes.
 */
function parseTocNcx(ncxDoc: Document, ncxDir: string): TocNode[] {
  const navMap = ncxDoc.querySelector("navMap")
  if (!navMap) return []

  return walkNcxNavPoints(navMap, ncxDir)
}

// ── Sidebar HTML Generation (5.6) ─────────────────────────────────────────

/**
 * Generate a sidebar HTML fragment from the TOC tree.
 *
 * Produces a `<nav class="ex-toc">` element containing a nested `<ol>`
 * structure with path-relative `<a href>` links. Sections with children
 * are wrapped in `<details open>` with `<summary>` for collapsibility.
 *
 * @param toc  The parsed TOC tree.
 * @returns An HTML string for injection into the viewer sidebar.
 */
function generateSidebarHtml(toc: TocNode[]): string {
  if (toc.length === 0) {
    return '<nav class="ex-toc"><p>No table of contents available.</p></nav>'
  }

  const listHtml = tocToHtml(toc)
  return `<nav class="ex-toc">${listHtml}</nav>`
}

/**
 * Recursively convert a TOC node array to HTML list markup.
 *
 * @param nodes  TOC nodes to convert.
 * @returns An HTML `<ol>` element as a string.
 */
function tocToHtml(nodes: TocNode[]): string {
  if (nodes.length === 0) return ""

  let html = "<ol>"
  for (const node of nodes) {
    html += "<li>"

    if (node.children && node.children.length > 0) {
      // Collapsible section with children
      html += "<details open>"
      html += `<summary><a href="${escapeHtml(node.href)}">${escapeHtml(node.label)}</a></summary>`
      html += tocToHtml(node.children)
      html += "</details>"
    } else {
      // Leaf entry — just a link
      html += `<a href="${escapeHtml(node.href)}">${escapeHtml(node.label)}</a>`
    }

    html += "</li>"
  }
  html += "</ol>"

  return html
}

/**
 * Escape HTML special characters in a string.
 *
 * Prevents XSS from publisher-controlled TOC labels.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ── Main Entry Point (5.5 + 5.7) ──────────────────────────────────────────

/**
 * Parse the book structure from unzipped EPUB entries.
 *
 * This is the main entry point, called at upload time during
 * `AddEpubsExtracted`. It:
 *
 * 1. Reads and parses the OPF document
 * 2. Extracts the spine reading order
 * 3. Locates and parses the TOC (NCX for EPUB 2, NAV for EPUB 3)
 * 4. Generates a pre-rendered sidebar HTML fragment
 *
 * @param entries   Map of file path → file content (from unzipped EPUB).
 * @param metadata  EPUB metadata including the OPF path.
 * @returns The complete book structure.
 */
export function parseBookStructure(
  entries: Map<string, ArrayBuffer>,
  metadata: IEpub,
): BookStructure {
  // Read and parse the OPF
  const opfData = entries.get(metadata.OpfPath)
  if (!opfData) {
    throw new Error(
      `OPF file "${metadata.OpfPath}" not found in EPUB entries.`,
    )
  }
  const opfXml = decodeBuffer(opfData)
  const opfDoc = parseXml(opfXml)
  const opfDir = dirname(metadata.OpfPath)

  // Parse spine
  const spine = parseSpine(opfDoc, opfDir)

  // Parse TOC — try EPUB 3 NAV first, then EPUB 2 NCX
  let toc: TocNode[] = []

  // Check for EPUB 3 NAV document
  const navItem = findNavItem(opfDoc)
  if (navItem) {
    const navPath = resolveHref(navItem, opfDir)
    const navData = entries.get(navPath)
    if (navData) {
      try {
        const navHtml = decodeBuffer(navData)
        const navDoc = parseHtml(navHtml)
        toc = parseTocNav(navDoc, dirname(navPath))
      } catch (err) {
        console.warn(
          `[BookParser] Failed to parse NAV document at "${navPath}":`,
          err,
        )
      }
    }
  }

  // Fall back to EPUB 2 NCX if no NAV data found
  if (toc.length === 0) {
    const ncxPath = findNcxPath(opfDoc, opfDir)
    if (ncxPath) {
      const ncxData = entries.get(ncxPath)
      if (ncxData) {
        try {
          const ncxXml = decodeBuffer(ncxData)
          const ncxDoc = parseXml(ncxXml)
          toc = parseTocNcx(ncxDoc, dirname(ncxPath))
        } catch (err) {
          console.warn(
            `[BookParser] Failed to parse NCX document at "${ncxPath}":`,
            err,
          )
        }
      }
    }
  }

  // Generate sidebar HTML
  const sidebarHtml = generateSidebarHtml(toc)

  if (toc.length === 0) {
    console.warn(
      `[BookParser] No TOC found for "${metadata.title ?? metadata.uniqueIdentifier}". ` +
        "Sidebar will show placeholder.",
    )
  }

  return { spine, toc, sidebarHtml }
}

/**
 * Find the NAV document href from the OPF manifest.
 *
 * EPUB 3: `<item properties="nav" href="nav.xhtml"/>`
 *
 * @param opfDoc  Parsed OPF document.
 * @returns The raw href of the NAV document, or null if not found.
 */
function findNavItem(opfDoc: Document): string | null {
  for (const item of opfDoc.querySelectorAll("item")) {
    const properties = item.getAttribute("properties") ?? ""
    if (properties.includes("nav")) {
      return item.getAttribute("href")
    }
  }
  return null
}

/**
 * Find the NCX document path from the OPF spine.
 *
 * EPUB 2: `<spine toc="ncx">` → look up `ncx` id in manifest.
 *
 * @param opfDoc  Parsed OPF document.
 * @param opfDir  Directory containing the OPF file.
 * @returns The resolved NCX path, or null if not found.
 */
function findNcxPath(opfDoc: Document, opfDir: string): string | null {
  const spine = opfDoc.querySelector("spine")
  if (!spine) return null

  const tocId = spine.getAttribute("toc")
  if (!tocId) return null

  // Look up the NCX id in the manifest
  for (const item of opfDoc.querySelectorAll("item")) {
    if (item.getAttribute("id") === tocId) {
      const href = item.getAttribute("href")
      if (href) {
        return resolveHref(href, opfDir)
      }
    }
  }

  return null
}