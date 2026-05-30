## Why

The current EPUB storage convention scatters a book's artifacts across three sibling entries (`bookId.epub`, `bookId.epub.json`, `bookId.epubdir/`) at the same directory level. This makes deletion fragile (must clean up three separate paths) and prevents the `.epubdir` directory from being fully self-contained. A self-contained convention simplifies deletion to a single `rmdir`, makes the `.epubdir` a portable unit, and prepares the storage layout for upcoming book-level metadata files (`spine.json`, `toc.json`, `sidebar.html`) that will live inside the `.epubdir`.

## What Changes

- **BREAKING**: Move `.epub` and `.epub.json` inside `.epubdir/`, renamed to `book.epub` and `book.json`
- **BREAKING**: All new book metadata artifacts (`spine.json`, `toc.json`, `sidebar.html`) are written at the `.epubdir/` root, not as siblings
- Change `ViewModel.AddEpubsExtracted` to write all artifacts inside the single `.epubdir/` directory
- Change `ViewModel.DelEpubsAt` to use a single `rmdir` instead of deleting three sibling entries
- Change `ViewModel._scanDir` (directory scan) to look for `book.json` inside `.epubdir` directories instead of sibling `.epub.json` files
- Change the EPUB explorer UI delete confirmation/action to reflect the simpler deletion path (no behavioral change, internal cleanup only)
- Update the `IEpub` type if `OpfPath` needs re-basing (the OPF path is relative to the epubdir root, which doesn't change)

## Capabilities

### New Capabilities
<!-- None — this is a refactor, not a new feature -->

### Modified Capabilities
- **epub-explorer**: The storage convention for EPUB artifacts is changing — `.epub` and `.epub.json` move inside `.epubdir/` and are renamed to `book.epub` and `book.json`. The directory scan (`_scanDir`) now inspects inside `.epubdir` directories instead of looking for sibling files. The `DelEpubsAt` method deletes by `rmdir` (single operation) instead of unlinking three sibling entries.

## Impact

- `src/lib/epub-lib/view-model.ts` — major rewrite of `AddEpubsExtracted`, `DelEpubsAt`, `_scanDir`, `_persistEpubDir`
- `src/lib/epub-lib/type.ts` — `IEpub.OpfPath` semantics unchanged (still relative to epubdir root), but verify
- `src/lib/epub-lib/epubzip.ts` — no change needed (extraction logic unchanged)
- `src/components/epub-explorer/epub-item-menu.tsx` — minor: delete confirmation text may reference simpler path
- `src/components/epub-explorer/add-from-dir.tsx` — minor: directory regeneration uses new scan logic
- `src/sw-routes/epub.ts` — no change: SW still serves from `.epubdir/` paths
- Existing ZenFS data: **BREAKING** — any previously uploaded EPUBs in the old format will not be discoverable after this change. Manual migration or re-upload required.