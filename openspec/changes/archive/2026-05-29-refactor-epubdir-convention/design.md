## Context

Currently, adding an EPUB writes three sibling entries at the collection path:
- `<safeId>.epub` — the raw file
- `<safeId>.epub.json` — serialized `IEpub` metadata
- `<safeId>.epubdir/` — unzipped content directory

This scattered layout complicates deletion (three unlink operations plus error handling for partial cleanup) and prevents the `.epubdir` from being a portable, self-contained unit. The upcoming EPUB viewer feature needs to store additional per-book metadata files (`spine.json`, `toc.json`, `sidebar.html`) — adding them as siblings would make the flat directory even more cluttered.

## Goals / Non-Goals

**Goals:**
- Make each `.epubdir` directory fully self-contained (all book artifacts inside)
- Simplify `DelEpubsAt` from three deletes to a single `rmdir`
- Prepare the storage layout for per-book metadata files (`spine.json`, `toc.json`, `sidebar.html`)
- Update `_scanDir` to read metadata from inside `.epubdir` directories

**Non-Goals:**
- Changing the `.epubdir` suffix convention
- Changing the `EpubCollection` type or in-memory key structure
- Changing the `IEpub` type (except confirming `OpfPath` semantics)
- Migrating existing EPUB data (users re-upload after this change)
- Changing the EPUB explorer UI behavior (add/delete UX unchanged)

## Decisions

### Decision 1: Move artifacts into `.epubdir/`, rename to fixed names

The `.epub` file is renamed to `book.epub` and `.epub.json` is renamed to `book.json` inside the `.epubdir` root.

**Rationale**: Fixed names (`book.epub`, `book.json`) eliminate the need to reconstruct the sanitized unique identifier when reading from the directory. The directory name already encodes the identifier; the internal filenames can be predictable constants.

**Alternatives considered**:
- Keep sanitized-ID-based names inside `.epubdir/`: Would preserve the identifier in filenames but adds no value since the directory name already carries it. Rejected as redundant.
- Use a single `manifest.json` combining all metadata: Would couple IEpub metadata with spine/toc data. Rejected — separate files allow independent reads (e.g., viewer only needs `book.json` + `toc.json` without loading spine data).

### Decision 2: `_scanDir` enters `.epubdir` directories to find `book.json`

Previously `_scanDir` *skipped* `.epubdir` directories entirely. Now it enters them, looks for `book.json`, parses it, and extracts the `IEpub` metadata. The directory name (minus `.epubdir` suffix) is the sanitized identifier.

**Rationale**: The metadata file is now inside the directory — the scanner must enter to find it. The `.epubdir` suffix on the directory name still provides the deterministic signal that this is a book artifact, not a user collection.

### Decision 3: `DelEpubsAt` uses single `rmdir` with recursive removal

`promisesFs.rmdir(fullPath)` replaces the three separate `unlink`/`rmdir` calls. This is a single atomic(ish) operation — ZenFS's WebAccess backend maps this to removing the directory handle.

**Rationale**: Cleaner code, no partial-cleanup edge case (if unlink of `.epub` succeeds but `.epubdir` fails, the old code left orphan artifacts; the new code either fully removes or fully retains).

### Decision 4: No automatic migration

Existing EPUBs in the old sibling-file format are silently lost after this change. Users must re-upload.

**Rationale**: The project is pre-release with no real user data. Writing migration code for a transitive state adds complexity with no practical benefit. The `viewModel.json` cache would also be invalidated.

**Alternative considered**: Migration script that reads old siblings, creates new structure, deletes old files. Rejected — the empty/null state after migration (ZenFS directory looks different) would cause edge cases in `_scanDir` that are worse than a clean break.

### Decision 5: `IEpub.OpfPath` remains unchanged

`OpfPath` is relative to the EPUB archive root (e.g., `"OEBPS/content.opf"`), which corresponds to the `.epubdir/` root after extraction. Since the extraction directory structure doesn't change, `OpfPath` semantics are unaffected.

## Risks / Trade-offs

- **[Risk] Users with existing EPUBs lose them silently**: `_scanDir` won't find old-style sibling files. Mitigation: The change is pre-release; document in changelog. The EPUB explorer will show an empty tree, which is visible to the user.
- **[Risk] `rmdir` on WebAccess may not reliably delete recursively**: ZenFS's `rmdir` maps to FSA's `DirectoryHandle.remove()`, which is recursive. But if the handle is partially locked, it may fail silently. Mitigation: The existing code already had this risk with the old `rmdir` call for `.epubdir/` — no regression.
- **[Trade-off] Fixed internal filenames mean you can't store multiple EPUBs with different metadata in one `.epubdir`**: This is not a use case — one directory = one book.