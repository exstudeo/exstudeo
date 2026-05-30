# EPUB Explorer

## Purpose

The EPUB Explorer provides a user-facing page at `/epub` for browsing, adding, and deleting EPUBs within the app. It renders the EPUB collection as an interactive tree view using the `EpubCollection` data stored in ZenFS, and supports directory regeneration from the virtual filesystem.

## Requirements

### Requirement: EPUB storage convention uses `.epubdir`

The system SHALL store all EPUB artifacts (raw file, metadata, unzipped content, and book-level data files) inside a single directory named `<unique-identifier-sanitized>.epubdir`. The internal filenames SHALL use fixed names: `book.epub` for the raw file, `book.json` for `IEpub` metadata, `spine.json` for spine order data, `toc.json` for the table of contents tree, and `sidebar.html` for the pre-rendered TOC HTML fragment. No EPUB artifacts SHALL exist as siblings of the `.epubdir` directory.

**Reason**: The `.epubdir` naming convention makes it possible to deterministically distinguish EPUB content directories from user-defined collection directories by name alone. Moving all artifacts inside makes the directory self-contained and simplifies deletion to a single `rmdir`.

#### Scenario: EPUB content stored in `.epubdir`
- **WHEN** an EPUB with unique identifier `book123` is added
- **THEN** a directory `book123.epubdir/` is created at the collection path
- **AND** all artifacts are written inside it: `book.epub`, `book.json`, `spine.json`, `toc.json`, `sidebar.html`, and the unzipped content tree

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

### Requirement: EPUB explorer page at `/epub`
The system SHALL provide a dedicated page at the `/epub` SPA route that displays the EPUB collection as an interactive tree view.

#### Scenario: Route exists
- **WHEN** the user navigates to `/epub`
- **THEN** the EPUB explorer page renders instead of a 404

#### Scenario: Persistent tab in app shell
- **WHEN** the app shell renders
- **THEN** a tab labeled "epub" appears between the "/reader" and "/settings" tabs

#### Scenario: Tab activates on navigation
- **WHEN** the user clicks the "epub" tab
- **THEN** the browser navigates to `/epub` and the EPUB explorer page renders

### Requirement: ViewModel provides reactive EPUB collection state
The system SHALL provide a ViewModel class that manages the EPUB collection as reactive state, exposing `subscribe()`, `getCollectionSnapshot()`, and mutation methods (`AddEpubsExtracted`, `DelEpubsAt`, `regenerateFromDirectory`).

#### Scenario: ViewModel loaded from viewModel.json
- **WHEN** the ViewModel is constructed without an explicit collection
- **THEN** it reads `viewModel.json` from the configured `epub.zenFSPath` in ZenFS and initializes its internal collection from it

#### Scenario: ViewModel falls back to directory scan
- **WHEN** `viewModel.json` does not exist at construction time
- **THEN** the ViewModel calls `getCollectionFromStorage()`, persists the result as `viewModel.json`, and uses the scanned collection

#### Scenario: ViewModel emits collection snapshot
- **WHEN** `getCollectionSnapshot()` is called
- **THEN** it returns a stable reference to the current collection (only changes after mutation)

#### Scenario: ViewModel notifies subscribers after mutation
- **WHEN** a mutation method (AddEpubsExtracted, DelEpubsAt, regenerateFromDirectory) completes
- **THEN** all registered subscribers are notified via their callbacks

#### Scenario: subscribe returns unsubscribe function
- **WHEN** `subscribe(callback)` is called
- **THEN** it returns a function that, when called, removes the callback from the subscriber set

### Requirement: Tree view renders EpubCollection as hierarchy
The system SHALL transform an `EpubCollection` into an array of `TreeDataItem` objects suitable for the shadcn-tree-view component.

#### Scenario: Collection node displayed with its key
- **WHEN** a key in `EpubCollection` maps to a sub-collection (contains nested keys)
- **THEN** the tree node displays the key name as its label and shows expand/collapse

#### Scenario: EPUB leaf displayed with its title
- **WHEN** a key in `EpubCollection` maps to an `IEpub` object
- **THEN** the tree node displays the `title` field (falling back to `uniqueIdentifier`) as its label

#### Scenario: Collection node has "Add Epub" action
- **WHEN** the user opens the menu on a collection tree node
- **THEN** a "Add Epub" option is available that triggers a file picker to add EPUB files into that collection

#### Scenario: EPUB leaf node has "Delete Epub" action
- **WHEN** the user opens the menu on an EPUB leaf node
- **THEN** a "Delete Epub" option is available that removes the EPUB from the collection and deletes its files from ZenFS

### Requirement: "Add Epub" button at root level
The system SHALL provide an "Add Epub" button in the EPUB explorer toolbar that adds files to the root collection.

#### Scenario: Button is visible
- **WHEN** the EPUB explorer page renders
- **THEN** a "Add Epub" button is shown at the top-right of the toolbar, next to "From Directory"

#### Scenario: Click opens file picker
- **WHEN** the user clicks "Add Epub"
- **THEN** a browser file picker opens accepting `.epub` files with multiple selection enabled

#### Scenario: Files are added to root collection
- **WHEN** the user selects EPUB files
- **THEN** each file is extracted via `extractEpub()`, written to ZenFS under `epub.zenFSPath`, the in-memory collection is updated, `viewModel.json` is persisted, and subscribers are notified

### Requirement: AddEpubsExtracted processes files with skip-on-error

The `AddEpubsExtracted` method SHALL process each EPUB file independently, skipping files that fail extraction, book structure parsing, or persistence and collecting a summary of failures. All ZenFS writes for an EPUB must succeed before the in-memory collection is updated; partial artifacts are cleaned up on failure. After extraction, the method SHALL call `parseBookStructure()` to generate `spine.json`, `toc.json`, and `sidebar.html`, and write these into the `.epubdir/` directory alongside `book.epub`, `book.json`, and the unzipped content.

#### Scenario: All artifacts written inside epubdir
- **WHEN** an EPUB is added with safeId `"book123"`
- **THEN** a directory `book123.epubdir/` is created
- **AND** `book.epub` and `book.json` are written at its root
- **AND** unzipped content is extracted inside it (e.g., `book123.epubdir/OEBPS/ch01.xhtml`)

#### Scenario: Single file failure does not block others
- **WHEN** multiple EPUB files are provided and one fails to parse or persist
- **THEN** the failing file is skipped, a `console.warn` is logged, and processing continues with the remaining files

#### Scenario: Failures are reported to the caller
- **WHEN** some EPUB files fail during addition
- **THEN** the caller receives a summary (counts and names of failures) so it can alert the user

#### Scenario: Partial artifacts cleaned up on failure
- **WHEN** an EPUB's writes fail partway through
- **THEN** the entire `<safeId>.epubdir/` directory is removed via `rmdir` (best-effort), and the in-memory collection is not updated for that EPUB

#### Scenario: Book structure files written into epubdir
- **WHEN** an EPUB is successfully added
- **THEN** `spine.json`, `toc.json`, and `sidebar.html` are written at the root of `<safeId>.epubdir/`
- **AND** each file contains valid JSON or HTML generated by `parseBookStructure()`

#### Scenario: Book structure parsing failure is treated as extraction failure
- **WHEN** `parseBookStructure()` throws (e.g., malformed NCX)
- **THEN** the EPUB is reported as failed, the epubdir is cleaned up, and processing continues with remaining files

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

### Requirement: "From Directory" regeneration
The system SHALL provide a button labeled "From Directory" at the top of the EPUB explorer that triggers a full regeneration of the EPUB collection from ZenFS storage.

#### Scenario: Button is visible
- **WHEN** the EPUB explorer page renders
- **THEN** a "From Directory" button is shown at the top of the page

#### Scenario: Regeneration replaces viewModel.json
- **WHEN** the user clicks "From Directory"
- **THEN** the system scans the `epub.zenFSPath` in ZenFS, builds a fresh `EpubCollection` by entering `.epubdir` directories and reading `book.json` metadata, writes the result to `viewModel.json`, replaces the in-memory collection, and notifies all subscribers

### Requirement: EpubCollection type supports recursive tree structure
The system SHALL use a recursive type where each key maps to either a sub-collection or an `IEpub` leaf.

#### Scenario: Type is indexable
- **WHEN** accessing a key on `EpubCollection`
- **THEN** the value is typed as `EpubCollection | IEpub`

### Requirement: ViewModel accepts raw `fs` and `promises` objects
The ViewModel SHALL accept the synchronous ZenFS `fs` object and the asynchronous ZenFS `promises` object rather than the full `ZenFSState` hook interface.

#### Scenario: Constructor signature
- **WHEN** constructing a new ViewModel
- **THEN** the constructor accepts `appConfig: AppConfig`, `fs: typeof import("@/lib/zenfs").fs`, and `promises: typeof import("@/lib/zenfs").promises`

### Requirement: ViewModel sanitizes filenames for FSA compatibility
The ViewModel SHALL sanitize all ZenFS filenames by replacing characters forbidden by the File System Access API (`:`, `\`, `/`, `?`, `"`, `<`, `>`, `|`) with `_`. The in-memory collection keys SHALL retain the original (unsanitized) `uniqueIdentifier`.

#### Scenario: Filenames with colons are sanitized
- **WHEN** an EPUB with `uniqueIdentifier: "urn:uuid:699b..."` is added
- **THEN** the ZenFS file is stored as `urn_uuid_699b....epub`
- **AND** the in-memory collection key remains `"urn:uuid:699b..."`

### Requirement: ViewModel uses promises API for all mutations
The ViewModel SHALL use ZenFS's `promises` API (`promises.writeFile`, `promises.mkdir`, `promises.unlink`, etc.) for all filesystem mutations. The sync API (`fs.*Sync`) SHALL only be used for reads during initialization. This ensures FSA errors propagate as rejected promises rather than unhandled promise rejections.

#### Scenario: AddEpubsExtracted uses promises.writeFile
- **WHEN** `AddEpubsExtracted()` persists an EPUB
- **THEN** it uses `this.promisesFs.writeFile()`, `this.promisesFs.mkdir()` to write all artifacts inside the `.epubdir/`
- **AND** FSA rejections are caught by the try/catch block

### Requirement: viewModel.json writes are serialized
Writes to `viewModel.json` SHALL be serialized through a promise chain (`_writeQueue`) to prevent interleaved writes when rapid mutations occur concurrently. Each mutation chains its write onto the previous one. The queue SHALL stay alive even if an individual write fails (errors consumed, not propagated).

#### Scenario: Two rapid deletions serialize their writes
- **WHEN** `DelEpubsAt` is called twice in rapid succession
- **THEN** the second write waits for the first to complete via `_writeQueue`
- **AND** `viewModel.json` is not corrupted

### Requirement: viewModel.json is unlinked before writing
When writing `viewModel.json`, the ViewModel SHALL `unlink` the file before `writeFile` because ZenFS's WebAccess/FSA backend does not reliably truncate existing files with flag `'w'`. Old content can remain after writing shorter content.

#### Scenario: Shrinking collection unlinks before write
- **WHEN** the collection shrinks (e.g., from 2 EPUBs to `{}`)
- **THEN** `_writeViewModelFile` unlinks `viewModel.json` before writing the new content
- **AND** no stale data remains after the new content

### Requirement: notifyUpdate is always called after mutation
The ViewModel SHALL call `notifyUpdate()` after every mutation even if the `viewModel.json` write fails. The write call SHALL be wrapped in try/catch to prevent an exception from blocking the subscriber notification.

#### Scenario: Failed write does not block UI update
- **WHEN** `_writeViewModelFile` rejects (write fails)
- **THEN** the catch block logs a warning
- **AND** `notifyUpdate()` is still called
- **AND** the in-memory collection is reflected in the UI

### Requirement: ViewModel notifies service worker after write
After successfully writing `viewModel.json`, the ViewModel SHALL call `notifyServiceWorker()` from `@/lib/zenfs` to notify the Service Worker's independent ZenFS instance that file contents have changed. Without this, the SW serves stale file data (throws `"Unexpected mismatch in file data size"`).

#### Scenario: SW receives notification after viewModel.json write
- **WHEN** `_writeViewModelFile` completes successfully
- **THEN** `notifyServiceWorker()` is called
- **AND** the SW's `_mountsDirty` flag is set
- **AND** the next `/@epubs/` request gets fresh file data