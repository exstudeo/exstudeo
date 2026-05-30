## ADDED Requirements

### Requirement: Files under fsUrlBidirectional paths render as hyperlinks

The system SHALL render file entries whose ZenFS path falls under a prefix listed in `AppConfig.explorer.fsUrlBidirectional` as `<a href>` hyperlinks. The `href` SHALL be computed by transforming `<basepath>/<rest>` to `/@<routerpath>/<rest>`, where `routerpath` is `basepath` with the leading `/` removed. Only non-directory file entries SHALL receive hyperlinks.

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