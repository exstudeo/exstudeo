# File Explorer

## Purpose

A browse-only directory explorer that displays the ZenFS virtual filesystem as a table. Users can navigate directories, sort columns, and see file metadata. File CRUD operations are deliberately excluded.

## Requirements

### Requirement: Show virtual filesystem root
The file explorer SHALL display the contents of the ZenFS root directory `/`, which shows all mounted backends as top-level directory entries.

#### Scenario: Display mount points
- **WHEN** the user opens the Files tab and two mounts ("Notes" at `/notes`, "Books" at `/books`) are active
- **THEN** the directory listing shows two directories named `notes` and `books`

#### Scenario: Empty state
- **WHEN** no mounts are active and the user opens the Files tab
- **THEN** the explorer shows an empty state message inviting the user to add a directory

### Requirement: Directory navigation
The system SHALL allow the user to navigate into directories by clicking on them, updating the displayed path and file list.

#### Scenario: Navigate into directory
- **WHEN** the user clicks on a directory entry in the file listing
- **THEN** the explorer shows the contents of that directory, and the breadcrumb updates to reflect the current path

#### Scenario: Navigate back to parent
- **WHEN** the user clicks the parent directory entry ("..")
- **THEN** the explorer shows the parent directory contents

#### Scenario: Navigate via breadcrumb
- **WHEN** the user clicks on a breadcrumb segment
- **THEN** the explorer navigates directly to that path

### Requirement: Table-form file listing
The system SHALL display directory contents in a table with columns for Name, Size, Type, and Modified date.

#### Scenario: Display file entries
- **WHEN** a directory has files and subdirectories
- **THEN** each entry is displayed as a row with the file/directory name, size (human-readable), type (extension or "folder"), and last modified date

#### Scenario: Sort by column
- **WHEN** the user clicks a column header
- **THEN** the listing is sorted by that column; clicking again toggles ascending/descending order

### Requirement: Open file action is stubbed
The system SHALL provide an action to "open" a file, but the implementation SHALL be a no-op placeholder for future reader integration.

#### Scenario: Click on file
- **WHEN** the user clicks on a file entry
- **THEN** the system logs the file path to the console (no-op for now)

### Requirement: Directory contents are read-only
The system SHALL NOT allow creating, renaming, or deleting files or directories through the explorer.

#### Scenario: No CRUD controls
- **WHEN** the explorer renders a directory listing
- **THEN** no create, rename, or delete controls are visible

### Requirement: Files under fsUrlBidirectional paths render as hyperlinks

The system SHALL render file entries whose ZenFS path falls under a prefix listed in `AppConfig.explorer.fsUrlBidirectional` as `<a href>` hyperlinks. The `href` SHALL be computed by transforming `<basepath>/<rest>` to `/@<routerpath>/<rest>`, where `routerpath` is `basepath` with the leading `/` removed. Only non-directory file entries SHALL receive hyperlinks. Hyperlinks SHALL open in a new tab.

#### Scenario: Correct href construction for matching file

- **WHEN** `config.explorer.fsUrlBidirectional` contains `"/epubs"` and a file entry has path `"/epubs/subdir/book.html"`
- **THEN** the entry SHALL have `href` set to `"/@epubs/subdir/book.html"`

#### Scenario: No href for file outside configured prefixes

- **WHEN** `config.explorer.fsUrlBidirectional` contains `"/epubs"` and a file entry has path `"/notes/readme.md"`
- **THEN** the entry SHALL NOT have an `href` set

#### Scenario: No href for parent directory entry

- **WHEN** the parent directory entry ("..") is rendered at any path
- **THEN** it SHALL NOT have an `href` set, regardless of `fsUrlBidirectional` contents

#### Scenario: No href for directory entries

- **WHEN** a directory entry has a path that starts with a prefix from `fsUrlBidirectional`
- **THEN** the entry SHALL NOT have an `href` set

#### Scenario: Hyperlink opens in new tab

- **WHEN** a user clicks a file name wrapped in `<a href="/@epubs/file.html">`
- **THEN** the link SHALL open in a new browser tab (not SPA navigation), allowing the service worker to intercept and serve the file
