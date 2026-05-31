## ADDED Requirements

### Requirement: parseBookStructure extracts spine from OPF

The system SHALL provide a `parseBookStructure()` function that accepts the EPUB's unzipped entries (`Map<string, ArrayBuffer>`) and `IEpub` metadata, and returns a `BookStructure` object. The spine SHALL be extracted by parsing the OPF document and querying all `itemref` elements within `<spine>`, producing an array of `SpineItem` objects with `id`, `idref`, `linear` (boolean, defaults to true), and `href` (resolved from the manifest).

#### Scenario: Linear spine extracted from EPUB 2 OPF
- **WHEN** the OPF contains `<spine toc="ncx"><itemref idref="ch01"/><itemref idref="ch02"/></spine>`
- **THEN** the spine array has two entries, both with `linear: true`

#### Scenario: Non-linear spine items marked correctly
- **WHEN** an `itemref` has `linear="no"`
- **THEN** the corresponding `SpineItem` has `linear: false`

#### Scenario: href resolved from manifest
- **WHEN** `itemref` has `idref="ch01"` and the manifest contains `<item id="ch01" href="OEBPS/ch01.xhtml"/>`
- **THEN** the `SpineItem.href` is `"OEBPS/ch01.xhtml"`

### Requirement: parseBookStructure extracts TOC from EPUB 3 NAV document

For EPUB 3, the system SHALL locate the Navigation Document via the manifest (looking for `properties="nav"`), parse its HTML with DOMParser, select `nav[epub\\:type="toc"] ol`, and recursively walk `<li><a><ol>` to build a `TocNode` tree. Each node SHALL have `label` (text content of `<a>`) and `href` (resolved relative to the NAV document's location).

#### Scenario: Flat TOC extracted from EPUB 3 NAV
- **WHEN** the NAV document contains `<nav epub:type="toc"><ol><li><a href="ch01.xhtml">Chapter 1</a></li></ol></nav>`
- **THEN** the TOC tree has one root node with `label: "Chapter 1"` and `href: "OEBPS/ch01.xhtml"`

#### Scenario: Nested TOC extracted from EPUB 3 NAV
- **WHEN** the NAV document contains nested `<ol>` elements for subsections
- **THEN** the TOC tree has parent nodes with `children` arrays containing sub-section nodes

### Requirement: parseBookStructure extracts TOC from EPUB 2 NCX document

For EPUB 2, the system SHALL locate the NCX file via the OPF spine's `toc` attribute, parse its XML with DOMParser, and use TreeWalker to traverse `navMap > navPoint` recursively. Each `navPoint` SHALL yield a `TocNode` with `label` (from `navLabel/text`) and `href` (from `content/@src`, resolved relative to the NCX location).

#### Scenario: Flat NCX TOC extracted
- **WHEN** the NCX contains `<navMap><navPoint id="np1"><navLabel><text>Chapter 1</text></navLabel><content src="ch01.xhtml"/></navPoint></navMap>`
- **THEN** the TOC tree has one root node with `label: "Chapter 1"` and `href` resolved to `"OEBPS/ch01.xhtml"`

#### Scenario: Nested NCX navPoints extracted recursively
- **WHEN** the NCX contains a `navPoint` with child `navPoint` elements
- **THEN** the parent node's `children` array contains the child nodes
- **AND** the TreeWalker traverses through all nesting levels

### Requirement: parseBookStructure returns BookStructure with all three outputs

The `parseBookStructure()` function SHALL return a `BookStructure` object containing `spine: SpineItem[]`, `toc: TocNode[]`, and `sidebarHtml: string`. The `sidebarHtml` SHALL be an HTML fragment (`<nav class="ex-toc"><ol>...</ol></nav>`) with path-relative `<a href>` links generated from the TOC tree.

#### Scenario: BookStructure contains spine, toc, and sidebarHtml
- **WHEN** `parseBookStructure()` completes successfully
- **THEN** the returned object has non-empty `spine`, `toc`, and `sidebarHtml` properties

### Requirement: sidebar.html uses path-relative hrefs and collapsible sections

The generated `sidebar.html` SHALL use path-relative URLs in all `<a href>` attributes (e.g., `href="OEBPS/ch02.xhtml"`, NOT absolute `/@epubs/...` URLs). Sections with children SHALL be wrapped in `<details open>` elements with `<summary>` for the section label, making them collapsible without JavaScript.

#### Scenario: Path-relative links in sidebar
- **WHEN** the TOC contains a node with href `"OEBPS/ch02.xhtml"`
- **THEN** the generated sidebar HTML contains `<a href="OEBPS/ch02.xhtml">` (no leading slash or domain)

#### Scenario: Collapsible sections for nested TOC
- **WHEN** the TOC has a node with children
- **THEN** the generated sidebar HTML wraps the children in `<details open>` with `<summary>` for the parent label

### Requirement: Unknown or missing TOC handled gracefully

When an EPUB has no NCX (EPUB 2) or NAV (EPUB 3) document, `parseBookStructure()` SHALL return an empty TOC tree (`[]`) and a `sidebarHtml` containing only `<nav class="ex-toc"><p>No table of contents available.</p></nav>`. The spine SHALL still be populated if the OPF has a spine.

#### Scenario: Missing NCX produces empty TOC
- **WHEN** an EPUB 2 OPF has `toc=""` or the toc attribute is absent
- **THEN** the TOC tree is an empty array
- **AND** sidebarHtml contains a placeholder message

#### Scenario: Missing NAV produces empty TOC
- **WHEN** an EPUB 3 manifest has no item with `properties="nav"`
- **THEN** the TOC tree is an empty array
- **AND** sidebarHtml contains a placeholder message

### Requirement: NCX and NAV href resolution is relative to their own directory

All hrefs in the TOC tree SHALL be resolved relative to the directory containing the NCX or NAV document (not the OPF or the epubdir root). This matches how EPUB reading systems resolve TOC links.

#### Scenario: NCX href relative to NCX location
- **WHEN** the NCX is at `OEBPS/toc.ncx` and a navPoint has `content src="ch01.xhtml"`
- **THEN** the resolved href is `"OEBPS/ch01.xhtml"`

#### Scenario: NAV href relative to NAV location
- **WHEN** the NAV document is at `OEBPS/nav.xhtml` and a link has `href="ch01.xhtml"`
- **THEN** the resolved href is `"OEBPS/ch01.xhtml"`