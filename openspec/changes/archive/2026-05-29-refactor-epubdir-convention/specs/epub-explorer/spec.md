## MODIFIED Requirements

### Requirement: EPUB storage convention uses `.epubdir`

The system SHALL store all EPUB artifacts (raw file, metadata, unzipped content, and book-level data files) inside a single directory named `<unique-identifier-sanitized>.epubdir`. The internal filenames SHALL use fixed names: `book.epub` for the raw file, `book.json` for `IEpub` metadata, `spine.json` for spine order data, `toc.json` for the table of contents tree, and `sidebar.html` for the pre-rendered TOC HTML fragment. No EPUB artifacts SHALL exist as siblings of the `.epubdir` directory.

**Reason**: The `.epubdir` naming convention makes it possible to deterministically distinguish EPUB content directories from user-defined collection directories by name alone. Moving all artifacts inside makes the directory self-contained and simplifies deletion to a single `rmdir`.

#### Scenario: EPUB content stored in `.epubdir`
- **WHEN** an EPUB with unique identifier `book123` is added
- **THEN** a directory `book123.epubdir/` is created at the collection path
- **AND** all artifacts are written inside it: `book.epub`, `book.json`, and the unzipped content tree

#### Scenario: No sibling artifacts exist
- **WHEN** an EPUB with unique identifier `book123` is added
- **THEN** no `book123.epub` or `book123.epub.json` files exist at the collection path
- **AND** the only artifact at the collection path is the `book123.epubdir/` directory

### Requirement: Directory scan enters `.epubdir` to read metadata

The `getCollectionFromStorage()` scan SHALL treat any directory whose name ends with `.epubdir` as an EPUB artifact. Instead of skipping it, the scanner SHALL enter the directory, look for `book.json`, parse it as `IEpub` metadata, and add the EPUB to the collection using the original (unsanitized) `uniqueIdentifier` from the metadata as the collection key. Directories ending with `.epubdir` SHALL NOT be recursed into as sub-collections — only `book.json` is read from their root.

**Reason**: With metadata files now inside `.epubdir`, the scanner must enter to discover EPUBs. The `.epubdir` suffix still provides the signal to treat it as a leaf (book) rather than a branch (sub-collection).

#### Scenario: Scans into `.epubdir` for metadata
- **WHEN** the scanner encounters a directory named `book123.epubdir`
- **THEN** it reads `book.json` from inside the directory
- **AND** parses it as `IEpub` metadata
- **AND** uses `metadata.uniqueIdentifier` as the collection key (not the directory name)

#### Scenario: Skips `.epubdir` as sub-collection
- **WHEN** the scanner encounters a directory named `classics` (no `.epubdir` suffix, and contains a `book123.epubdir` inside)
- **THEN** it recurses into `classics` as a sub-collection
- **AND** the scan at `classics/` discovers `book123.epubdir` and reads its `book.json`

#### Scenario: `.epubdir` without book.json is skipped
- **WHEN** a directory ends with `.epubdir` but contains no `book.json`
- **THEN** the scanner skips it and adds no entry to the collection
- **AND** no error is thrown

#### Scenario: Processes other directories as collections
- **WHEN** the scanner encounters a directory named `classics` (no `.epubdir` suffix)
- **THEN** it is recursed into as a sub-collection

### Requirement: DelEpubsAt deletes the single `.epubdir` directory

The `DelEpubsAt` method SHALL remove the EPUB entries from the in-memory collection first, then delete the single `<safeId>.epubdir/` directory from ZenFS using `promises.rmdir()`, then persist and notify. No sibling files SHALL be deleted because none exist. The `rmdir` call SHALL be the only filesystem operation needed for deletion.

#### Scenario: Single rmdir operation
- **WHEN** an EPUB with unique identifier `"book123"` in collection path `["sci-fi"]` is deleted
- **THEN** only the directory `zenFSPath/sci-fi/book123.epubdir/` is removed from ZenFS
- **AND** no sibling `.epub` or `.epub.json` files are deleted (they don't exist)

#### Scenario: In-memory collection updated before rmdir
- **WHEN** `DelEpubsAt` is called
- **THEN** the EPUB entries are removed from `this.collection` before the `rmdir` call begins

#### Scenario: Collection persisted after deletion
- **WHEN** `DelEpubsAt` completes
- **THEN** `viewModel.json` is updated and subscribers are notified

### Requirement: AddEpubsExtracted writes all artifacts inside `.epubdir`

The `AddEpubsExtracted` method SHALL create a single `<safeId>.epubdir/` directory for each EPUB and write all artifacts inside it: `book.epub` (the raw file), `book.json` (serialized `IEpub` metadata), and the unzipped content entries (preserving the EPUB's internal directory structure). No files SHALL be written as siblings of the `.epubdir` directory. On failure, the entire `.epubdir/` SHALL be cleaned up via `rmdir`.

#### Scenario: All artifacts written inside epubdir
- **WHEN** an EPUB is added with safeId `"book123"`
- **THEN** a directory `book123.epubdir/` is created
- **AND** `book.epub` and `book.json` are written at its root
- **AND** unzipped content is extracted inside it (e.g., `book123.epubdir/OEBPS/ch01.xhtml`)

#### Scenario: Cleanup on failure deletes epubdir
- **WHEN** an EPUB's writes fail partway through
- **THEN** the entire `<safeId>.epubdir/` directory is removed via `rmdir`
- **AND** the in-memory collection is not updated for that EPUB