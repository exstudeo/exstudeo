# HTML Rewrite Pipeline

## Purpose

TBD — A composable, strategy-based HTML rewriting pipeline for transforming EPUB HTML pages in the service worker before serving them to the browser.

## Requirements

### Requirement: HtmlRewritePipeline composes ordered strategies

The system SHALL provide an `HtmlRewritePipeline` class that accepts an ordered array of `HtmlTransformStrategy` objects and applies them sequentially to an HTML response body. Each strategy SHALL implement `name`, `shouldApply(ctx)`, and `apply(html, ctx)` methods. Strategies SHALL be applied in array order and each strategy's `shouldApply` SHALL be called before its `apply` method.

#### Scenario: Strategies applied in order
- **WHEN** `HtmlRewritePipeline.transform(htmlBytes, ctx)` is called with three strategies [A, B, C]
- **THEN** strategy A's `apply` runs first, then B, then C
- **AND** each strategy sees the output of the previous strategy

#### Scenario: Strategy skipped when shouldApply returns false
- **WHEN** a strategy's `shouldApply(ctx)` returns `false`
- **THEN** its `apply` method is not called
- **AND** subsequent strategies are still applied

### Requirement: HtmlTransformHandle wraps html-rewriter

The system SHALL provide an `HtmlTransformHandle` that wraps the `worker-tools/html-rewriter` (lol-html WASM) and exposes a minimal API: `on(selector, handlers)` for element-level transformations. The handle SHALL support the full lol-html element handler API (`element()`, `comments()`, `text()`) through its `on` method.

#### Scenario: handle.on registers element handler
- **WHEN** `handle.on("script", { element(el) { el.remove() } })` is called
- **THEN** all `<script>` elements are removed during transformation

#### Scenario: handle.on registers multiple selectors
- **WHEN** `handle.on("style", handlers1)` and `handle.on("link[rel=stylesheet]", handlers2)` are both called
- **THEN** both sets of handlers are active during transformation

### Requirement: SanitizeStrategy removes dangerous content

The system SHALL provide a `SanitizeStrategy` that removes all `<script>` elements, all `<style>` elements, all inline `style=""` attributes, and all inline event handler attributes (`onclick`, `onload`, `onerror`, etc.) from EPUB HTML pages. The strategy SHALL NOT remove `<link>` elements (they may be re-added by other strategies) but SHALL remove `href` attributes from `<link rel="stylesheet">` elements.

#### Scenario: Script elements removed
- **WHEN** the sanitize strategy processes an HTML page with `<script>alert('xss')</script>`
- **THEN** the script element is removed from the output

#### Scenario: Inline event handlers removed
- **WHEN** the sanitize strategy processes `<div onclick="doSomething()">`
- **THEN** the `onclick` attribute is removed from the div element

#### Scenario: Inline styles removed
- **WHEN** the sanitize strategy processes `<p style="color: red">`
- **THEN** the `style` attribute is removed from the p element

#### Scenario: Style elements removed
- **WHEN** the sanitize strategy processes `<style>body { margin: 0 }</style>`
- **THEN** the style element is removed from the output

#### Scenario: Publisher stylesheet links stripped
- **WHEN** the sanitize strategy processes `<link rel="stylesheet" href="style.css">`
- **THEN** the `href` attribute is removed (but the element remains)

### Requirement: InjectStylesStrategy adds viewer stylesheet

The system SHALL provide an `InjectStylesStrategy` that appends `<link rel="stylesheet" href="/epub-assets/epub-style.css">` to the `<head>` element of EPUB HTML pages. If no `<head>` element exists, the strategy SHALL create one before `<body>` or at the start of `<html>`.

#### Scenario: Stylesheet injected into head
- **WHEN** the inject styles strategy processes an HTML page with `<head>...</head>`
- **THEN** a `<link rel="stylesheet" href="/epub-assets/epub-style.css">` element is appended inside `<head>`

#### Scenario: Head created if missing
- **WHEN** the inject styles strategy processes an HTML page without a `<head>` element
- **THEN** a `<head>` element is created and the stylesheet link is placed inside it

### Requirement: InjectViewerStrategy adds viewer script

The system SHALL provide an `InjectViewerStrategy` that appends `<script type="module" src="/epub-assets/epub-viewer.js"></script>` before the `</body>` closing tag of EPUB HTML pages.

#### Scenario: Viewer script injected before body end
- **WHEN** the inject viewer strategy processes an HTML page with `<body>...</body>`
- **THEN** a `<script type="module" src="/epub-assets/epub-viewer.js"></script>` element is appended before `</body>`

#### Scenario: Viewer script injected when body exists but has no closing tag
- **WHEN** the inject viewer strategy processes an HTML page with `<body>` but without `</body>`
- **THEN** the script element is appended at the end of the `<body>` content (lol-html handles end-of-element injection)

### Requirement: Default pipeline returns ready-to-use strategy array

The system SHALL export a `defaultEpubPipeline()` function that returns `[SanitizeStrategy, InjectStylesStrategy, InjectViewerStrategy]` in order, ready to be passed to `HtmlRewritePipeline`.

#### Scenario: Default pipeline has three strategies
- **WHEN** `defaultEpubPipeline()` is called
- **THEN** it returns an array of three strategies
- **AND** their names are "sanitize", "inject-styles", and "inject-viewer" in that order

### Requirement: HtmlTransformStrategy type is exported

The system SHALL export the `HtmlTransformStrategy` interface and `EpubPageContext` type from the HTML rewrite module, allowing consumers to implement custom strategies.

#### Scenario: Custom strategy implements the interface
- **WHEN** a developer creates an object with `name`, `shouldApply`, and `apply` methods
- **THEN** TypeScript accepts it as an `HtmlTransformStrategy`