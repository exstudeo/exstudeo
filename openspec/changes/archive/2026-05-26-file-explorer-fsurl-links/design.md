## Context

The file explorer (`FileExplorerPage` → `DirectoryTable`) currently renders all file entries as plain table rows. Clicking a file triggers a no-op `onOpenFile` stub that logs to console. Meanwhile, the service worker has an EPUB route strategy (`createEpubRouteStrategy()`) that intercepts `GET /@epubs/<rest>.html`, reads from ZenFS, and serves the file content as HTML.

The config system already defines `ExplorerConfig.fsUrlBidirectional: string[]` — an array of ZenFS mount path prefixes that should be bidirectionally linked (default: `["/epubs"]`). The transformation rule is:

> `<basepath>/<rest>` → `/@<routerpath>/<rest>`

Where `routerpath` = `basepath` with the leading `/` removed. For example, `/epubs/subdir/file.html` → `/@epubs/subdir/file.html`.

## Goals / Non-Goals

**Goals:**
- File entries whose ZenFS path falls under a prefix in `fsUrlBidirectional` render as `<a href>` links
- Clicking such a link performs a full-page navigation so the SW intercepts it
- Non-matching files, directories, and parent ".." entries remain unchanged
- The existing `onOpenFile` stub continues to work for files outside configured prefixes

**Non-Goals:**
- No changes to the SW, config system, or reader
- No UI for editing `fsUrlBidirectional` (already editable via settings JSON editor)
- No new dependencies

## Decisions

1. **Full navigation vs. SPA navigation**: Use `window.location.href = href` (full page load) rather than React Router's `navigate()`. The `/@epubs/` path is NOT a registered SPA route — it's handled entirely by the SW. Full navigation ensures the SW's `fetch` handler intercepts the request.

2. **`<a>` link with `stopPropagation`**: The row-level `onClick` handles both directory navigation and file opening. For entries with `href`, the `<a>` element gets `onClick={(e) => e.stopPropagation()}` so the row click doesn't also fire. This cleanly separates the link action from the row navigation.

3. **Href computed in `FileExplorerPage`, not `DirectoryTable`**: Computing the href requires access to `useConfig()` which is a React hook. `DirectoryTable` is a presentational component that receives props. The href is computed in the `useMemo` that builds the `entries[]` array in `FileExplorerPage` and added to each `FileEntry` object. This keeps `DirectoryTable` pure and testable.

4. **Path matching**: For each file entry's `path`, check if `path.startsWith(prefix + "/")` or `path === prefix`. This prevents partial prefix matches (e.g., `/epubx` matching prefix `/epub`). The `rest` is `path.slice(prefix.length)`.

## Risks / Trade-offs

- **Full navigation is heavier than SPA**: Navigating to `/@epubs/file.html` causes a full page reload. This is acceptable because it's a user-initiated navigation and the SW serves the response. Future optimization could use SW-streamed SPA navigation if needed.
- **Path mismatch risk**: If a mount path contains a trailing slash mismatch, the computed href could be wrong. The mount store normalises paths (no trailing `/`), and `fsUrlBidirectional` values should follow the same convention. No validation is added — it's a configuration concern.
- **No href for ".." entry**: The parent directory entry ("..") is added manually with its own path logic. It never receives an href because `isDirectory: true` is checked first. This is correct behavior.