## Why

The file explorer currently shows files in a table with a no-op "open file" action. The service worker already handles `/@epubs/<rest_path>.html` requests by reading files from ZenFS and serving them as HTML. Closing this loop — making file names clickable links that navigate to the SW-served URL — gives users instant access to rendered content without any additional reader integration.

## What Changes

- Files in the explorer whose zenfs path falls under a prefix listed in `AppConfig.explorer.fsUrlBidirectional` are rendered as `<a href>` hyperlinks pointing to the SW-served URL (e.g., `/@epubs/subdir/file.html`).
- The `FileEntry` interface gains an optional `href` field.
- `FileExplorerPage` computes `href` for each file entry by matching its zenfs path against the configured prefixes and transforming to the `/@<routerpath>/<rest>` format.
- `DirectoryTable` renders the name column as an `<a>` element when `href` is present, with proper styling and click handling (full navigation so the SW intercepts it).
- The existing `onOpenFile` stub remains unchanged for files outside `fsUrlBidirectional` prefixes.

## Capabilities

### New Capabilities
*(none — this modifies an existing capability)*

### Modified Capabilities
- `file-explorer`: Add a new requirement — "Files under fsUrlBidirectional paths render as hyperlinks" — and corresponding scenarios for matching/non-matching files and parent directory behavior.

## Impact

- **`apps/web/src/lib/config.ts`**: Already has `ExplorerConfig.fsUrlBidirectional` — no type changes needed.
- **`apps/web/src/components/file-explorer/page.tsx`**: Import `useConfig()` hook, compute `href` in the entries memo.
- **`apps/web/src/components/file-explorer/directory-table.tsx`**: Add optional `href` to `FileEntry`, render `<a>` link in name cell, adjust row click behavior.
- **`apps/web/src/hooks/use-config.ts`**: Already exists and ready to use — no changes.
- **`openspec/specs/file-explorer/spec.md`**: Add new requirement with scenarios.